// edge-grpc: gRPC transport proxy for Totem Edge Runtime.
//
// Architecture:
//   TypeScript (EdgeRuntime) ←→ TCP/JSON ←→ Go binary ←→ gRPC/HTTP2 ←→ gRPC server
//
// The Go binary accepts newline-delimited JSON commands from the TypeScript
// native transport and translates them to real gRPC calls using the standard
// google.golang.org/grpc library. All protobuf payloads are base64-encoded
// in the JSON protocol.
//
// Supported operations:
//   connect     — dial a gRPC server
//   disconnect  — close the gRPC connection
//   unary       — single request → single response
//   server_stream — single request → stream of responses
//   client_stream — stream of requests → single response
//   bidi_stream — bidirectional streaming
//   stream_send — send a message on an open stream
//   stream_close — close the send side of a stream
//
// Environment:
//   GRPC_LISTEN_ADDR  — TCP address to listen on (default: 127.0.0.1:15005)
//   GRPC_TIMEOUT_MS   — default deadline in ms (default: 30000)

package main

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net"
	"os"
	"strconv"
	"sync"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
)

// ── JSON protocol types ──────────────────────────────────────────────────

type Request struct {
	ID       string `json:"id"`
	Type     string `json:"type"`
	Address  string `json:"address,omitempty"`
	Path     string `json:"path,omitempty"`
	Payload  string `json:"payload,omitempty"`  // base64-encoded protobuf
	Deadline int    `json:"deadline_ms,omitempty"`
	StreamID string `json:"stream_id,omitempty"`
}

type Response struct {
	ID       string `json:"id"`
	OK       bool   `json:"ok"`
	Data     string `json:"data,omitempty"`     // base64-encoded protobuf
	Error    string `json:"error,omitempty"`
	Code     int    `json:"code,omitempty"`     // gRPC status code
	StreamID string `json:"stream_id,omitempty"`
}

type PushMessage struct {
	Type     string `json:"type"`               // "stream_data" | "stream_end" | "stream_error"
	StreamID string `json:"stream_id"`
	Payload  string `json:"payload,omitempty"`
	Error    string `json:"error,omitempty"`
	Code     int    `json:"code,omitempty"`
}

// ── Server ───────────────────────────────────────────────────────────────

type Server struct {
	config   Config
	mu       sync.RWMutex
	clients  map[net.Conn]struct{}
	conn     *grpc.ClientConn
	connAddr string
	streams  map[string]streamHandle
	listener net.Listener
	stopCh   chan struct{}
}

type Config struct {
	ListenAddr string
	TimeoutMs  int
}

type streamHandle struct {
	stream grpc.ClientStream
	cancel context.CancelFunc
	ctx    context.Context
}

func main() {
	config := Config{
		ListenAddr: getEnv("GRPC_LISTEN_ADDR", "127.0.0.1:15005"),
		TimeoutMs:  getEnvInt("GRPC_TIMEOUT_MS", 30000),
	}

	srv := &Server{
		config:  config,
		clients: make(map[net.Conn]struct{}),
		streams: make(map[string]streamHandle),
		stopCh:  make(chan struct{}),
	}

	log.Printf("[edge-grpc] gRPC transport proxy starting")
	log.Printf("[edge-grpc] Listening on %s", config.ListenAddr)

	if err := srv.Listen(); err != nil {
		log.Fatalf("[edge-grpc] Failed to start: %v", err)
	}

	select {}
}

func (s *Server) Listen() error {
	var err error
	s.listener, err = net.Listen("tcp", s.config.ListenAddr)
	if err != nil {
		return fmt.Errorf("listen: %w", err)
	}

	go func() {
		for {
			conn, err := s.listener.Accept()
			if err != nil {
				select {
				case <-s.stopCh:
					return
				default:
					log.Printf("[edge-grpc] Accept error: %v", err)
					continue
				}
			}
			s.mu.Lock()
			s.clients[conn] = struct{}{}
			s.mu.Unlock()
			log.Printf("[edge-grpc] Client connected: %s", conn.RemoteAddr())
			go s.handleConn(conn)
		}
	}()

	return nil
}

// ── Connection handler ───────────────────────────────────────────────────

func (s *Server) handleConn(conn net.Conn) {
	defer func() {
		s.mu.Lock()
		delete(s.clients, conn)
		s.mu.Unlock()
		conn.Close()
		log.Printf("[edge-grpc] Client disconnected: %s", conn.RemoteAddr())
	}()

	buf := make([]byte, 0, 64*1024)
	tmp := make([]byte, 4096)

	for {
		n, err := conn.Read(tmp)
		if err != nil {
			return
		}
		buf = append(buf, tmp[:n]...)

		for {
			nl := -1
			for i, b := range buf {
				if b == '\n' {
					nl = i
					break
				}
			}
			if nl < 0 {
				break
			}

			line := string(buf[:nl])
			buf = buf[nl+1:]

			if line == "" {
				continue
			}

			var req Request
			if err := json.Unmarshal([]byte(line), &req); err != nil {
				s.writeResponse(conn, Response{ID: "", OK: false, Error: fmt.Sprintf("invalid json: %v", err)})
				continue
			}

			s.handleRequest(conn, &req)
		}
	}
}

// ── Request dispatcher ───────────────────────────────────────────────────

func (s *Server) handleRequest(conn net.Conn, req *Request) {
	switch req.Type {
	case "connect":
		s.handleConnect(conn, req)
	case "disconnect":
		s.handleDisconnect(conn, req)
	case "unary":
		s.handleUnary(conn, req)
	case "server_stream":
		s.handleServerStream(conn, req)
	case "client_stream":
		s.handleClientStream(conn, req)
	case "bidi_stream":
		s.handleBidiStream(conn, req)
	case "stream_send":
		s.handleStreamSend(conn, req)
	case "stream_close":
		s.handleStreamClose(conn, req)
	default:
		s.writeResponse(conn, Response{ID: req.ID, OK: false, Error: fmt.Sprintf("unknown request type: %s", req.Type)})
	}
}

// ── connect / disconnect ──────────────────────────────────────────────────

func (s *Server) handleConnect(conn net.Conn, req *Request) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.conn != nil {
		s.conn.Close()
	}

	ctx, cancel := context.WithTimeout(context.Background(), time.Duration(s.config.TimeoutMs)*time.Millisecond)
	defer cancel()

	grpcConn, err := grpc.DialContext(ctx, req.Address,
		grpc.WithTransportCredentials(insecure.NewCredentials()),
		grpc.WithBlock(),
	)
	if err != nil {
		s.writeResponse(conn, Response{ID: req.ID, OK: false, Error: fmt.Sprintf("dial failed: %v", err)})
		return
	}

	s.conn = grpcConn
	s.connAddr = req.Address
	log.Printf("[edge-grpc] Connected to gRPC server: %s", req.Address)
	s.writeResponse(conn, Response{ID: req.ID, OK: true})
}

func (s *Server) handleDisconnect(conn net.Conn, req *Request) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.conn != nil {
		s.conn.Close()
		s.conn = nil
		s.connAddr = ""
	}
	s.writeResponse(conn, Response{ID: req.ID, OK: true})
}

// ── unary ────────────────────────────────────────────────────────────────

func (s *Server) handleUnary(conn net.Conn, req *Request) {
	s.mu.RLock()
	grpcConn := s.conn
	s.mu.RUnlock()

	if grpcConn == nil {
		s.writeResponse(conn, Response{ID: req.ID, OK: false, Error: "not connected"})
		return
	}

	payload, err := base64.StdEncoding.DecodeString(req.Payload)
	if err != nil {
		s.writeResponse(conn, Response{ID: req.ID, OK: false, Error: fmt.Sprintf("invalid base64: %v", err)})
		return
	}

	deadline := time.Duration(req.Deadline) * time.Millisecond
	if deadline <= 0 {
		deadline = time.Duration(s.config.TimeoutMs) * time.Millisecond
	}
	ctx, cancel := context.WithTimeout(context.Background(), deadline)
	defer cancel()

	var respData []byte
	var respHeader, respTrailer metadata.MD

	err = grpcConn.Invoke(ctx, req.Path, payload, &respData,
		grpc.Header(&respHeader),
		grpc.Trailer(&respTrailer),
	)
	if err != nil {
		st := status.Convert(err)
		s.writeResponse(conn, Response{
			ID: req.ID, OK: false,
			Error: st.Message(),
			Code:  int(st.Code()),
		})
		return
	}

	s.writeResponse(conn, Response{
		ID:   req.ID,
		OK:   true,
		Data: base64.StdEncoding.EncodeToString(respData),
	})
}

// ── server_stream ────────────────────────────────────────────────────────

func (s *Server) handleServerStream(conn net.Conn, req *Request) {
	s.mu.RLock()
	grpcConn := s.conn
	s.mu.RUnlock()

	if grpcConn == nil {
		s.writeResponse(conn, Response{ID: req.ID, OK: false, Error: "not connected"})
		return
	}

	payload, err := base64.StdEncoding.DecodeString(req.Payload)
	if err != nil {
		s.writeResponse(conn, Response{ID: req.ID, OK: false, Error: fmt.Sprintf("invalid base64: %v", err)})
		return
	}

	deadline := time.Duration(req.Deadline) * time.Millisecond
	if deadline <= 0 {
		deadline = time.Duration(s.config.TimeoutMs) * time.Millisecond
	}
	ctx, cancel := context.WithTimeout(context.Background(), deadline)

	stream, err := grpcConn.NewStream(ctx, &grpc.StreamDesc{
		StreamName:    req.Path,
		ServerStreams: true,
		ClientStreams: false,
	}, req.Path)
	if err != nil {
		cancel()
		st := status.Convert(err)
		s.writeResponse(conn, Response{
			ID: req.ID, OK: false,
			Error: st.Message(),
			Code:  int(st.Code()),
		})
		return
	}

	if err := stream.SendMsg(payload); err != nil {
		cancel()
		s.writeResponse(conn, Response{ID: req.ID, OK: false, Error: fmt.Sprintf("send failed: %v", err)})
		return
	}
	stream.CloseSend()

	// Acknowledge stream creation
	s.writeResponse(conn, Response{ID: req.ID, OK: true, StreamID: req.ID})

	// Read responses in background
	go func() {
		defer cancel()
		for {
			var msg []byte
			if err := stream.RecvMsg(&msg); err != nil {
				if err == io.EOF {
					s.pushToAll(PushMessage{Type: "stream_end", StreamID: req.ID})
				} else {
					st := status.Convert(err)
					s.pushToAll(PushMessage{
						Type: "stream_error", StreamID: req.ID,
						Error: st.Message(), Code: int(st.Code()),
					})
				}
				return
			}
			s.pushToAll(PushMessage{
				Type: "stream_data", StreamID: req.ID,
				Payload: base64.StdEncoding.EncodeToString(msg),
			})
		}
	}()
}

// ── client_stream ────────────────────────────────────────────────────────

func (s *Server) handleClientStream(conn net.Conn, req *Request) {
	s.mu.RLock()
	grpcConn := s.conn
	s.mu.RUnlock()

	if grpcConn == nil {
		s.writeResponse(conn, Response{ID: req.ID, OK: false, Error: "not connected"})
		return
	}

	deadline := time.Duration(req.Deadline) * time.Millisecond
	if deadline <= 0 {
		deadline = time.Duration(s.config.TimeoutMs) * time.Millisecond
	}
	ctx, cancel := context.WithTimeout(context.Background(), deadline)

	stream, err := grpcConn.NewStream(ctx, &grpc.StreamDesc{
		StreamName:    req.Path,
		ServerStreams: false,
		ClientStreams: true,
	}, req.Path)
	if err != nil {
		cancel()
		st := status.Convert(err)
		s.writeResponse(conn, Response{
			ID: req.ID, OK: false,
			Error: st.Message(), Code: int(st.Code()),
		})
		return
	}

	s.mu.Lock()
	s.streams[req.ID] = streamHandle{stream: stream, cancel: cancel, ctx: ctx}
	s.mu.Unlock()

	s.writeResponse(conn, Response{ID: req.ID, OK: true, StreamID: req.ID})

	// Wait for close, then receive response
	go func() {
		defer func() {
			cancel()
			s.mu.Lock()
			delete(s.streams, req.ID)
			s.mu.Unlock()
		}()

		// Block until RecvMsg returns (stream closed by client)
		var resp []byte
		if err := stream.RecvMsg(&resp); err != nil {
			st := status.Convert(err)
			s.pushToAll(PushMessage{
				Type: "stream_error", StreamID: req.ID,
				Error: st.Message(), Code: int(st.Code()),
			})
			return
		}
		s.pushToAll(PushMessage{
			Type: "stream_end", StreamID: req.ID,
			Payload: base64.StdEncoding.EncodeToString(resp),
		})
	}()
}

// ── bidi_stream ──────────────────────────────────────────────────────────

func (s *Server) handleBidiStream(conn net.Conn, req *Request) {
	s.mu.RLock()
	grpcConn := s.conn
	s.mu.RUnlock()

	if grpcConn == nil {
		s.writeResponse(conn, Response{ID: req.ID, OK: false, Error: "not connected"})
		return
	}

	deadline := time.Duration(req.Deadline) * time.Millisecond
	if deadline <= 0 {
		deadline = time.Duration(s.config.TimeoutMs) * time.Millisecond
	}
	ctx, cancel := context.WithTimeout(context.Background(), deadline)

	stream, err := grpcConn.NewStream(ctx, &grpc.StreamDesc{
		StreamName:    req.Path,
		ServerStreams: true,
		ClientStreams: true,
	}, req.Path)
	if err != nil {
		cancel()
		st := status.Convert(err)
		s.writeResponse(conn, Response{
			ID: req.ID, OK: false,
			Error: st.Message(), Code: int(st.Code()),
		})
		return
	}

	s.mu.Lock()
	s.streams[req.ID] = streamHandle{stream: stream, cancel: cancel, ctx: ctx}
	s.mu.Unlock()

	s.writeResponse(conn, Response{ID: req.ID, OK: true, StreamID: req.ID})

	// Read responses in background
	go func() {
		defer func() {
			cancel()
			s.mu.Lock()
			delete(s.streams, req.ID)
			s.mu.Unlock()
		}()
		for {
			var msg []byte
			if err := stream.RecvMsg(&msg); err != nil {
				if err == io.EOF {
					s.pushToAll(PushMessage{Type: "stream_end", StreamID: req.ID})
				} else {
					st := status.Convert(err)
					s.pushToAll(PushMessage{
						Type: "stream_error", StreamID: req.ID,
						Error: st.Message(), Code: int(st.Code()),
					})
				}
				return
			}
			s.pushToAll(PushMessage{
				Type: "stream_data", StreamID: req.ID,
				Payload: base64.StdEncoding.EncodeToString(msg),
			})
		}
	}()
}

// ── stream_send / stream_close ────────────────────────────────────────────

func (s *Server) handleStreamSend(conn net.Conn, req *Request) {
	s.mu.RLock()
	sh, ok := s.streams[req.StreamID]
	s.mu.RUnlock()

	if !ok {
		s.writeResponse(conn, Response{ID: req.ID, OK: false, Error: "stream not found"})
		return
	}

	payload, err := base64.StdEncoding.DecodeString(req.Payload)
	if err != nil {
		s.writeResponse(conn, Response{ID: req.ID, OK: false, Error: fmt.Sprintf("invalid base64: %v", err)})
		return
	}

	if err := sh.stream.SendMsg(payload); err != nil {
		s.writeResponse(conn, Response{ID: req.ID, OK: false, Error: fmt.Sprintf("send failed: %v", err)})
		return
	}

	s.writeResponse(conn, Response{ID: req.ID, OK: true})
}

func (s *Server) handleStreamClose(conn net.Conn, req *Request) {
	s.mu.RLock()
	sh, ok := s.streams[req.StreamID]
	s.mu.RUnlock()

	if !ok {
		s.writeResponse(conn, Response{ID: req.ID, OK: false, Error: "stream not found"})
		return
	}

	sh.stream.CloseSend()
	s.writeResponse(conn, Response{ID: req.ID, OK: true})
}

// ── Helpers ───────────────────────────────────────────────────────────────

func (s *Server) writeResponse(conn net.Conn, resp Response) {
	data, _ := json.Marshal(resp)
	data = append(data, '\n')
	conn.Write(data)
}

func (s *Server) pushToAll(msg PushMessage) {
	data, _ := json.Marshal(msg)
	data = append(data, '\n')

	s.mu.RLock()
	defer s.mu.RUnlock()
	for conn := range s.clients {
		conn.Write(data)
	}
}

func getEnv(key, defaultVal string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return defaultVal
}

func getEnvInt(key string, defaultVal int) int {
	if v := os.Getenv(key); v != "" {
		if i, err := strconv.Atoi(v); err == nil {
			return i
		}
	}
	return defaultVal
}
