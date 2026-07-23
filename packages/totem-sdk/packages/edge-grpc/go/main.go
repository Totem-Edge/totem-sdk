package main

import (
	"bufio"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"net"
	"os"
	"strconv"
	"sync"
	"time"
)

type Config struct {
	ListenAddr string `json:"listenAddr"`
	TimeoutMs  int    `json:"timeoutMs"`
}

type Request struct {
	ID      string `json:"id"`
	Type    string `json:"type"` // "connect", "disconnect", "send"
	Address string `json:"address,omitempty"`
	Data    string `json:"data,omitempty"` // hex-encoded bytes
}

type Response struct {
	ID    string `json:"id"`
	OK    bool   `json:"ok"`
	Data  string `json:"data,omitempty"` // hex-encoded response bytes
	Error string `json:"error,omitempty"`
}

type PushData struct {
	Type    string `json:"type"` // "data"
	Address string `json:"address"`
	Data    string `json:"data"` // hex-encoded bytes
}

type Server struct {
	config   Config
	mu       sync.RWMutex
	clients  map[net.Conn]struct{}
	conns    map[string]net.Conn // gRPC connections keyed by address
	listener net.Listener
	stopCh   chan struct{}
}

func main() {
	config := Config{
		ListenAddr: getEnv("GRPC_LISTEN_ADDR", "127.0.0.1:15005"),
		TimeoutMs:  getEnvInt("GRPC_TIMEOUT_MS", 10000),
	}

	srv := &Server{
		config:  config,
		clients: make(map[net.Conn]struct{}),
		conns:   make(map[string]net.Conn),
		stopCh:  make(chan struct{}),
	}

	log.Printf("[edge-grpc] Starting gRPC transport proxy")
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

func (s *Server) handleConn(conn net.Conn) {
	defer func() {
		s.mu.Lock()
		delete(s.clients, conn)
		s.mu.Unlock()
		conn.Close()
		log.Printf("[edge-grpc] Client disconnected: %s", conn.RemoteAddr())
	}()

	scanner := bufio.NewScanner(conn)
	scanner.Buffer(make([]byte, 1024*1024), 1024*1024)

	for scanner.Scan() {
		line := scanner.Text()
		if line == "" {
			continue
		}

		var req Request
		if err := json.Unmarshal([]byte(line), &req); err != nil {
			s.writeResponse(conn, Response{ID: "", OK: false, Error: fmt.Sprintf("invalid json: %v", err)})
			continue
		}

		switch req.Type {
		case "connect":
			grpcConn, err := net.DialTimeout("tcp", req.Address, time.Duration(s.config.TimeoutMs)*time.Millisecond)
			if err != nil {
				s.writeResponse(conn, Response{ID: req.ID, OK: false, Error: fmt.Sprintf("connect failed: %v", err)})
				continue
			}
			s.mu.Lock()
			s.conns[req.Address] = grpcConn
			s.mu.Unlock()

			// Start reading from the gRPC connection
			go s.readFromGRPC(req.Address, grpcConn)

			s.writeResponse(conn, Response{ID: req.ID, OK: true})

		case "disconnect":
			s.mu.Lock()
			if grpcConn, ok := s.conns[req.Address]; ok {
				grpcConn.Close()
				delete(s.conns, req.Address)
			}
			s.mu.Unlock()
			s.writeResponse(conn, Response{ID: req.ID, OK: true})

		case "send":
			s.mu.RLock()
			grpcConn, ok := s.conns[req.Address]
			s.mu.RUnlock()
			if !ok {
				s.writeResponse(conn, Response{ID: req.ID, OK: false, Error: fmt.Sprintf("not connected to %s", req.Address)})
				continue
			}

			data, err := hex.DecodeString(req.Data)
			if err != nil {
				s.writeResponse(conn, Response{ID: req.ID, OK: false, Error: fmt.Sprintf("invalid hex: %v", err)})
				continue
			}

			// Write gRPC frame: 1 byte compression flag + 4 bytes big-endian length + payload
			frame := make([]byte, 5+len(data))
			frame[0] = 0 // no compression
			frame[1] = byte(len(data) >> 24)
			frame[2] = byte(len(data) >> 16)
			frame[3] = byte(len(data) >> 8)
			frame[4] = byte(len(data))
			copy(frame[5:], data)

			if _, err := grpcConn.Write(frame); err != nil {
				s.writeResponse(conn, Response{ID: req.ID, OK: false, Error: fmt.Sprintf("write failed: %v", err)})
				continue
			}

			// Read response: 5-byte header + payload
			header := make([]byte, 5)
			grpcConn.SetReadDeadline(time.Now().Add(time.Duration(s.config.TimeoutMs) * time.Millisecond))
			if _, err := grpcConn.Read(header); err != nil {
				s.writeResponse(conn, Response{ID: req.ID, OK: false, Error: fmt.Sprintf("read header failed: %v", err)})
				continue
			}

			respLen := int(header[1])<<24 | int(header[2])<<16 | int(header[3])<<8 | int(header[4])
			respData := make([]byte, respLen)
			if _, err := grpcConn.Read(respData); err != nil {
				s.writeResponse(conn, Response{ID: req.ID, OK: false, Error: fmt.Sprintf("read body failed: %v", err)})
				continue
			}

			s.writeResponse(conn, Response{ID: req.ID, OK: true, Data: hex.EncodeToString(respData)})

		default:
			s.writeResponse(conn, Response{ID: req.ID, OK: false, Error: fmt.Sprintf("unknown request type: %s", req.Type)})
		}
	}
}

func (s *Server) readFromGRPC(address string, conn net.Conn) {
	defer func() {
		s.mu.Lock()
		delete(s.conns, address)
		s.mu.Unlock()
	}()

	for {
		header := make([]byte, 5)
		if _, err := conn.Read(header); err != nil {
			return
		}

		respLen := int(header[1])<<24 | int(header[2])<<16 | int(header[3])<<8 | int(header[4])
		if respLen > 16*1024*1024 {
			return
		}

		respData := make([]byte, respLen)
		if _, err := conn.Read(respData); err != nil {
			return
		}

		msg := PushData{
			Type:    "data",
			Address: address,
			Data:    hex.EncodeToString(respData),
		}
		s.broadcastPush(msg)
	}
}

func (s *Server) broadcastPush(msg PushData) {
	data, _ := json.Marshal(msg)
	data = append(data, '\n')

	s.mu.RLock()
	defer s.mu.RUnlock()
	for conn := range s.clients {
		conn.Write(data)
	}
}

func (s *Server) writeResponse(conn net.Conn, resp Response) {
	data, _ := json.Marshal(resp)
	data = append(data, '\n')
	conn.Write(data)
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
