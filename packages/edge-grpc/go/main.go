// edge-grpc: gRPC transport proxy for Totem Edge Runtime.
//
// TypeScript (EdgeRuntime) ←→ TCP/JSON ←→ this proxy ←→ gRPC/HTTP2 ←→ server.
//
// The proxy supports raw-byte unary and streaming calls (no generated
// protobuf), optional TLS (custom CA, client certificate, server name) and
// connection-level metadata for authentication. Each TypeScript client gets
// its own gRPC connection and stream namespace; stream pushes go only to the
// owning connection.
//
// Environment:
//   GRPC_LISTEN_ADDR  — TCP address to listen on (default: 127.0.0.1:15005)
//   GRPC_TIMEOUT_MS   — default deadline in ms (default: 30000)

package main

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net"
	"os"
	"os/signal"
	"strings"
	"sync"
	"sync/atomic"
	"syscall"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
)

const (
	protocolVersion = 1
	maxPayloadBytes = 8 << 20 // 8 MiB per message
	maxDeadlineMs   = 10 * 60 * 1000
)

// ── JSON protocol ────────────────────────────────────────────────────────

type TLSRequest struct {
	CACert             string `json:"caCert,omitempty"`
	Cert               string `json:"cert,omitempty"`
	Key                string `json:"key,omitempty"`
	ServerName         string `json:"serverName,omitempty"`
	InsecureSkipVerify bool   `json:"insecureSkipVerify,omitempty"`
}

type Request struct {
	ID        string            `json:"id"`
	Type      string            `json:"type"`
	Address   string            `json:"address,omitempty"`
	Path      string            `json:"path,omitempty"`
	Payload   string            `json:"payload,omitempty"`
	Deadline  int               `json:"deadline_ms,omitempty"`
	StreamID  string            `json:"stream_id,omitempty"`
	TLS       *TLSRequest       `json:"tls,omitempty"`
	Authority string            `json:"authority,omitempty"`
	Metadata  map[string]string `json:"metadata,omitempty"`
}

type Response struct {
	ID       string `json:"id"`
	OK       bool   `json:"ok"`
	Data     string `json:"data,omitempty"`
	Error    string `json:"error,omitempty"`
	Code     int    `json:"code,omitempty"`
	StreamID string `json:"stream_id,omitempty"`
}

type PushMessage struct {
	Type     string `json:"type"`
	StreamID string `json:"stream_id"`
	Payload  string `json:"payload,omitempty"`
	Error    string `json:"error,omitempty"`
	Code     int    `json:"code,omitempty"`
}

// ── Raw-byte gRPC codec ──────────────────────────────────────────────────

// rawCodec passes protobuf bytes through untouched. The "proto" name keeps the
// HTTP/2 content-subtype compatible with ordinary gRPC servers.
type rawCodec struct{}

func (rawCodec) Marshal(value any) ([]byte, error) {
	switch message := value.(type) {
	case *[]byte:
		return *message, nil
	case []byte:
		return message, nil
	default:
		return nil, fmt.Errorf("raw codec: unsupported type %T", value)
	}
}

func (rawCodec) Unmarshal(data []byte, value any) error {
	message, ok := value.(*[]byte)
	if !ok {
		return fmt.Errorf("raw codec: unsupported destination %T", value)
	}
	*message = append((*message)[:0], data...)
	return nil
}

func (rawCodec) Name() string { return "proto" }

// ── Server ───────────────────────────────────────────────────────────────

type Config struct {
	ListenAddr string
	TimeoutMs  int
}

type Server struct {
	config Config

	mu        sync.Mutex
	clients   map[net.Conn]*clientState
	listener  net.Listener
	stopCh    chan struct{}
	closeOnce sync.Once
	streamSeq atomic.Uint64
}

type clientState struct {
	conn     *grpc.ClientConn
	addr     string
	metadata metadata.MD
	streams  map[string]*streamHandle
}

type streamHandle struct {
	stream grpc.ClientStream
	cancel context.CancelFunc
}

func main() {
	if len(os.Args) > 1 && (os.Args[1] == "--version" || os.Args[1] == "-version") {
		fmt.Printf("edge-grpc protocol=%d\n", protocolVersion)
		return
	}

	config := Config{
		ListenAddr: getEnv("GRPC_LISTEN_ADDR", "127.0.0.1:15005"),
		TimeoutMs:  getEnvInt("GRPC_TIMEOUT_MS", 30000),
	}

	srv := &Server{
		config:  config,
		clients: make(map[net.Conn]*clientState),
		stopCh:  make(chan struct{}),
	}

	log.Printf("[edge-grpc] gRPC transport proxy starting")
	log.Printf("[edge-grpc] Listening on %s", config.ListenAddr)
	if err := srv.Listen(); err != nil {
		log.Fatalf("[edge-grpc] Failed to start: %v", err)
	}

	signals := make(chan os.Signal, 1)
	signal.Notify(signals, syscall.SIGINT, syscall.SIGTERM)
	<-signals
	srv.Shutdown()
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
			s.clients[conn] = &clientState{streams: make(map[string]*streamHandle)}
			s.mu.Unlock()
			log.Printf("[edge-grpc] Client connected: %s", conn.RemoteAddr())
			go s.handleConn(conn)
		}
	}()
	return nil
}

func (s *Server) Shutdown() {
	s.closeOnce.Do(func() {
		close(s.stopCh)
		if s.listener != nil {
			_ = s.listener.Close()
		}
		s.mu.Lock()
		conns := make([]net.Conn, 0, len(s.clients))
		for conn := range s.clients {
			conns = append(conns, conn)
		}
		s.mu.Unlock()
		for _, conn := range conns {
			_ = conn.Close()
		}
	})
}

func (s *Server) handleConn(conn net.Conn) {
	state := s.clientState(conn)
	defer func() {
		s.closeClient(conn)
		log.Printf("[edge-grpc] Client disconnected: %s", conn.RemoteAddr())
	}()

	buffer := make([]byte, 0, 64*1024)
	tmp := make([]byte, 4096)
	for {
		n, err := conn.Read(tmp)
		if err != nil {
			return
		}
		buffer = append(buffer, tmp[:n]...)
		for {
			index := strings.IndexByte(string(buffer), '\n')
			if index < 0 {
				break
			}
			line := string(buffer[:index])
			buffer = buffer[index+1:]
			if line == "" {
				continue
			}
			var req Request
			if err := json.Unmarshal([]byte(line), &req); err != nil {
				s.writeResponse(conn, Response{ID: "", OK: false, Error: fmt.Sprintf("invalid json: %v", err)})
				continue
			}
			s.handleRequest(conn, state, &req)
		}
	}
}

func (s *Server) clientState(conn net.Conn) *clientState {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.clients[conn]
}

func (s *Server) closeClient(conn net.Conn) {
	s.mu.Lock()
	state := s.clients[conn]
	delete(s.clients, conn)
	s.mu.Unlock()
	if state != nil {
		for _, handle := range state.streams {
			handle.cancel()
		}
		if state.conn != nil {
			_ = state.conn.Close()
		}
	}
	_ = conn.Close()
}

func (s *Server) handleRequest(conn net.Conn, state *clientState, req *Request) {
	switch req.Type {
	case "connect":
		s.handleConnect(conn, state, req)
	case "disconnect":
		s.handleDisconnect(conn, state, req)
	case "unary":
		s.handleUnary(conn, state, req)
	case "server_stream":
		s.handleServerStream(conn, state, req)
	case "client_stream":
		s.handleClientStream(conn, state, req)
	case "bidi_stream":
		s.handleBidiStream(conn, state, req)
	case "stream_send":
		s.handleStreamSend(conn, state, req)
	case "stream_close":
		s.handleStreamClose(conn, state, req)
	case "cancel_stream":
		s.handleCancelStream(conn, state, req)
	default:
		s.writeResponse(conn, Response{ID: req.ID, OK: false, Error: fmt.Sprintf("unknown request type: %s", req.Type)})
	}
}

// ── connect / disconnect ─────────────────────────────────────────────────

func (s *Server) handleConnect(conn net.Conn, state *clientState, req *Request) {
	if req.Address == "" {
		s.writeResponse(conn, Response{ID: req.ID, OK: false, Error: "address required"})
		return
	}

	var transport credentials.TransportCredentials
	if req.TLS != nil {
		tlsCredentials, err := buildTLSCredentials(req.TLS)
		if err != nil {
			s.writeResponse(conn, Response{ID: req.ID, OK: false, Error: err.Error()})
			return
		}
		transport = tlsCredentials
	} else {
		transport = insecure.NewCredentials()
	}

	options := []grpc.DialOption{
		grpc.WithTransportCredentials(transport),
		grpc.WithDefaultCallOptions(grpc.ForceCodec(rawCodec{})),
		grpc.WithBlock(),
	}
	if req.Authority != "" {
		options = append(options, grpc.WithAuthority(req.Authority))
	}

	ctx, cancel := context.WithTimeout(context.Background(), time.Duration(s.config.TimeoutMs)*time.Millisecond)
	defer cancel()

	grpcConn, err := grpc.DialContext(ctx, req.Address, options...)
	if err != nil {
		s.writeResponse(conn, Response{ID: req.ID, OK: false, Error: fmt.Sprintf("dial failed: %v", err)})
		return
	}

	md := metadata.New(nil)
	for key, value := range req.Metadata {
		md.Append(key, value)
	}

	s.mu.Lock()
	if state.conn != nil {
		_ = state.conn.Close()
	}
	for id, handle := range state.streams {
		handle.cancel()
		delete(state.streams, id)
	}
	state.conn = grpcConn
	state.addr = req.Address
	state.metadata = md
	s.mu.Unlock()

	log.Printf("[edge-grpc] Connected to gRPC server: %s (tls=%v)", req.Address, req.TLS != nil)
	s.writeResponse(conn, Response{ID: req.ID, OK: true})
}

func buildTLSCredentials(request *TLSRequest) (credentials.TransportCredentials, error) {
	config := &tls.Config{
		ServerName:         request.ServerName,
		InsecureSkipVerify: request.InsecureSkipVerify,
		MinVersion:         tls.VersionTLS12,
	}
	if request.CACert != "" {
		pool := x509.NewCertPool()
		if !pool.AppendCertsFromPEM([]byte(request.CACert)) {
			return nil, errors.New("invalid CA certificate")
		}
		config.RootCAs = pool
	}
	if request.Cert != "" || request.Key != "" {
		certificate, err := tls.X509KeyPair([]byte(request.Cert), []byte(request.Key))
		if err != nil {
			return nil, fmt.Errorf("invalid client certificate: %w", err)
		}
		config.Certificates = []tls.Certificate{certificate}
	}
	return credentials.NewTLS(config), nil
}

func (s *Server) handleDisconnect(conn net.Conn, state *clientState, req *Request) {
	s.mu.Lock()
	if state.conn != nil {
		_ = state.conn.Close()
		state.conn = nil
		state.addr = ""
		state.metadata = nil
	}
	for id, handle := range state.streams {
		handle.cancel()
		delete(state.streams, id)
	}
	s.mu.Unlock()
	s.writeResponse(conn, Response{ID: req.ID, OK: true})
}

// ── calls ────────────────────────────────────────────────────────────────

func (s *Server) callContext(state *clientState, deadlineMs int) (context.Context, context.CancelFunc, int) {
	deadline := deadlineMs
	if deadline <= 0 {
		deadline = s.config.TimeoutMs
	}
	if deadline > maxDeadlineMs {
		deadline = maxDeadlineMs
	}
	ctx, cancel := context.WithTimeout(context.Background(), time.Duration(deadline)*time.Millisecond)
	if state.metadata != nil {
		ctx = metadata.NewOutgoingContext(ctx, state.metadata)
	}
	return ctx, cancel, deadline
}

func (s *Server) connection(state *clientState) (*grpc.ClientConn, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return state.conn, state.conn != nil
}

func decodePayload(encoded string) ([]byte, error) {
	payload, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		return nil, fmt.Errorf("invalid base64: %w", err)
	}
	if len(payload) > maxPayloadBytes {
		return nil, fmt.Errorf("payload exceeds %d bytes", maxPayloadBytes)
	}
	return payload, nil
}

func validPath(path string) error {
	// gRPC method paths are exactly /service/method.
	parts := strings.Split(path, "/")
	if len(parts) != 3 || parts[0] != "" || parts[1] == "" || parts[2] == "" {
		return fmt.Errorf("invalid gRPC method path %q", path)
	}
	return nil
}

func (s *Server) handleUnary(conn net.Conn, state *clientState, req *Request) {
	if err := validPath(req.Path); err != nil {
		s.writeResponse(conn, Response{ID: req.ID, OK: false, Error: err.Error()})
		return
	}
	payload, err := decodePayload(req.Payload)
	if err != nil {
		s.writeResponse(conn, Response{ID: req.ID, OK: false, Error: err.Error()})
		return
	}
	grpcConn, ok := s.connection(state)
	if !ok {
		s.writeResponse(conn, Response{ID: req.ID, OK: false, Error: "not connected"})
		return
	}

	ctx, cancel, _ := s.callContext(state, req.Deadline)
	defer cancel()

	var response []byte
	err = grpcConn.Invoke(ctx, req.Path, &payload, &response)
	if err != nil {
		st := status.Convert(err)
		s.writeResponse(conn, Response{ID: req.ID, OK: false, Error: st.Message(), Code: int(st.Code())})
		return
	}
	s.writeResponse(conn, Response{ID: req.ID, OK: true, Data: base64.StdEncoding.EncodeToString(response)})
}

func (s *Server) newStreamID() string {
	return fmt.Sprintf("grpc-stream-%d", s.streamSeq.Add(1))
}

func (s *Server) registerStream(state *clientState, id string, handle *streamHandle) {
	s.mu.Lock()
	state.streams[id] = handle
	s.mu.Unlock()
}

func (s *Server) removeStream(state *clientState, id string) {
	s.mu.Lock()
	delete(state.streams, id)
	s.mu.Unlock()
}

func (s *Server) handleServerStream(conn net.Conn, state *clientState, req *Request) {
	if err := validPath(req.Path); err != nil {
		s.writeResponse(conn, Response{ID: req.ID, OK: false, Error: err.Error()})
		return
	}
	payload, err := decodePayload(req.Payload)
	if err != nil {
		s.writeResponse(conn, Response{ID: req.ID, OK: false, Error: err.Error()})
		return
	}
	grpcConn, ok := s.connection(state)
	if !ok {
		s.writeResponse(conn, Response{ID: req.ID, OK: false, Error: "not connected"})
		return
	}

	ctx, cancel, _ := s.callContext(state, req.Deadline)
	stream, err := grpcConn.NewStream(ctx, &grpc.StreamDesc{
		StreamName: req.Path, ServerStreams: true,
	}, req.Path)
	if err != nil {
		cancel()
		st := status.Convert(err)
		s.writeResponse(conn, Response{ID: req.ID, OK: false, Error: st.Message(), Code: int(st.Code())})
		return
	}
	if err := stream.SendMsg(&payload); err != nil {
		cancel()
		s.writeResponse(conn, Response{ID: req.ID, OK: false, Error: fmt.Sprintf("send failed: %v", err)})
		return
	}
	_ = stream.CloseSend()

	id := s.newStreamID()
	s.registerStream(state, id, &streamHandle{stream: stream, cancel: cancel})
	s.writeResponse(conn, Response{ID: req.ID, OK: true, StreamID: id})

	go func() {
		defer func() {
			cancel()
			s.removeStream(state, id)
		}()
		for {
			var message []byte
			if err := stream.RecvMsg(&message); err != nil {
				if err == io.EOF {
					s.pushToConn(conn, PushMessage{Type: "stream_end", StreamID: id})
				} else {
					st := status.Convert(err)
					s.pushToConn(conn, PushMessage{Type: "stream_error", StreamID: id, Error: st.Message(), Code: int(st.Code())})
				}
				return
			}
			s.pushToConn(conn, PushMessage{Type: "stream_data", StreamID: id, Payload: base64.StdEncoding.EncodeToString(message)})
		}
	}()
}

func (s *Server) handleClientStream(conn net.Conn, state *clientState, req *Request) {
	if err := validPath(req.Path); err != nil {
		s.writeResponse(conn, Response{ID: req.ID, OK: false, Error: err.Error()})
		return
	}
	grpcConn, ok := s.connection(state)
	if !ok {
		s.writeResponse(conn, Response{ID: req.ID, OK: false, Error: "not connected"})
		return
	}

	ctx, cancel, _ := s.callContext(state, req.Deadline)
	stream, err := grpcConn.NewStream(ctx, &grpc.StreamDesc{
		StreamName: req.Path, ClientStreams: true,
	}, req.Path)
	if err != nil {
		cancel()
		st := status.Convert(err)
		s.writeResponse(conn, Response{ID: req.ID, OK: false, Error: st.Message(), Code: int(st.Code())})
		return
	}

	id := s.newStreamID()
	s.registerStream(state, id, &streamHandle{stream: stream, cancel: cancel})
	s.writeResponse(conn, Response{ID: req.ID, OK: true, StreamID: id})

	go func() {
		defer func() {
			cancel()
			s.removeStream(state, id)
		}()
		var response []byte
		if err := stream.RecvMsg(&response); err != nil {
			st := status.Convert(err)
			s.pushToConn(conn, PushMessage{Type: "stream_error", StreamID: id, Error: st.Message(), Code: int(st.Code())})
			return
		}
		s.pushToConn(conn, PushMessage{
			Type: "stream_end", StreamID: id,
			Payload: base64.StdEncoding.EncodeToString(response),
		})
	}()
}

func (s *Server) handleBidiStream(conn net.Conn, state *clientState, req *Request) {
	if err := validPath(req.Path); err != nil {
		s.writeResponse(conn, Response{ID: req.ID, OK: false, Error: err.Error()})
		return
	}
	grpcConn, ok := s.connection(state)
	if !ok {
		s.writeResponse(conn, Response{ID: req.ID, OK: false, Error: "not connected"})
		return
	}

	ctx, cancel, _ := s.callContext(state, req.Deadline)
	stream, err := grpcConn.NewStream(ctx, &grpc.StreamDesc{
		StreamName: req.Path, ServerStreams: true, ClientStreams: true,
	}, req.Path)
	if err != nil {
		cancel()
		st := status.Convert(err)
		s.writeResponse(conn, Response{ID: req.ID, OK: false, Error: st.Message(), Code: int(st.Code())})
		return
	}

	id := s.newStreamID()
	s.registerStream(state, id, &streamHandle{stream: stream, cancel: cancel})
	s.writeResponse(conn, Response{ID: req.ID, OK: true, StreamID: id})

	go func() {
		defer func() {
			cancel()
			s.removeStream(state, id)
		}()
		for {
			var message []byte
			if err := stream.RecvMsg(&message); err != nil {
				if err == io.EOF {
					s.pushToConn(conn, PushMessage{Type: "stream_end", StreamID: id})
				} else {
					st := status.Convert(err)
					s.pushToConn(conn, PushMessage{Type: "stream_error", StreamID: id, Error: st.Message(), Code: int(st.Code())})
				}
				return
			}
			s.pushToConn(conn, PushMessage{Type: "stream_data", StreamID: id, Payload: base64.StdEncoding.EncodeToString(message)})
		}
	}()
}

// ── stream operations ────────────────────────────────────────────────────

func (s *Server) ownerStream(state *clientState, id string) (*streamHandle, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	handle, ok := state.streams[id]
	return handle, ok
}

func (s *Server) handleStreamSend(conn net.Conn, state *clientState, req *Request) {
	handle, ok := s.ownerStream(state, req.StreamID)
	if !ok {
		s.writeResponse(conn, Response{ID: req.ID, OK: false, Error: "stream not found"})
		return
	}
	payload, err := decodePayload(req.Payload)
	if err != nil {
		s.writeResponse(conn, Response{ID: req.ID, OK: false, Error: err.Error()})
		return
	}
	if err := handle.stream.SendMsg(&payload); err != nil {
		s.writeResponse(conn, Response{ID: req.ID, OK: false, Error: fmt.Sprintf("send failed: %v", err)})
		return
	}
	s.writeResponse(conn, Response{ID: req.ID, OK: true})
}

func (s *Server) handleStreamClose(conn net.Conn, state *clientState, req *Request) {
	handle, ok := s.ownerStream(state, req.StreamID)
	if !ok {
		s.writeResponse(conn, Response{ID: req.ID, OK: false, Error: "stream not found"})
		return
	}
	if err := handle.stream.CloseSend(); err != nil {
		s.writeResponse(conn, Response{ID: req.ID, OK: false, Error: fmt.Sprintf("close failed: %v", err)})
		return
	}
	s.writeResponse(conn, Response{ID: req.ID, OK: true})
}

func (s *Server) handleCancelStream(conn net.Conn, state *clientState, req *Request) {
	handle, ok := s.ownerStream(state, req.StreamID)
	if !ok {
		s.writeResponse(conn, Response{ID: req.ID, OK: true})
		return
	}
	handle.cancel()
	s.removeStream(state, req.StreamID)
	s.writeResponse(conn, Response{ID: req.ID, OK: true})
}

// ── output ───────────────────────────────────────────────────────────────

func (s *Server) writeResponse(conn net.Conn, resp Response) {
	data, err := json.Marshal(resp)
	if err != nil {
		return
	}
	data = append(data, '\n')
	_, _ = conn.Write(data)
}

func (s *Server) pushToConn(conn net.Conn, message PushMessage) {
	data, err := json.Marshal(message)
	if err != nil {
		return
	}
	data = append(data, '\n')
	_, _ = conn.Write(data)
}

func getEnv(key, defaultVal string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultVal
}

func getEnvInt(key string, defaultVal int) int {
	if value := os.Getenv(key); value != "" {
		var parsed int
		if _, err := fmt.Sscanf(value, "%d", &parsed); err == nil {
			return parsed
		}
	}
	return defaultVal
}
