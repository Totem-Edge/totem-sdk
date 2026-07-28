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
	BindPort   int    `json:"bindPort"`
	TimeoutMs  int    `json:"timeoutMs"`
}

type Request struct {
	ID   string `json:"id"`
	Host string `json:"host"`
	Port int    `json:"port"`
	Data string `json:"data"` // hex-encoded CoAP message
}

type Response struct {
	ID    string `json:"id"`
	OK    bool   `json:"ok"`
	Data  string `json:"data,omitempty"` // hex-encoded response
	Error string `json:"error,omitempty"`
}

type PushMessage struct {
	Type string `json:"type"` // "message"
	Host string `json:"host"`
	Port int    `json:"port"`
	Data string `json:"data"` // hex-encoded CoAP message
}

type Server struct {
	config   Config
	conn     *net.UDPConn
	mu       sync.RWMutex
	clients  map[net.Conn]struct{}
	listener net.Listener
	stopCh   chan struct{}
	pending  map[string]chan []byte
	pendingMu sync.Mutex
}

func main() {
	config := Config{
		ListenAddr: getEnv("COAP_LISTEN_ADDR", "127.0.0.1:15003"),
		BindPort:   getEnvInt("COAP_BIND_PORT", 5683),
		TimeoutMs:  getEnvInt("COAP_TIMEOUT_MS", 5000),
	}

	srv, err := NewServer(config)
	if err != nil {
		log.Fatalf("[edge-coap] Failed to create server: %v", err)
	}

	log.Printf("[edge-coap] Starting CoAP transport")
	log.Printf("[edge-coap] UDP bind port: %d", config.BindPort)
	log.Printf("[edge-coap] Listening on %s", config.ListenAddr)

	if err := srv.Listen(); err != nil {
		log.Fatalf("[edge-coap] Failed to start: %v", err)
	}

	select {}
}

func NewServer(config Config) (*Server, error) {
	addr := &net.UDPAddr{Port: config.BindPort}
	conn, err := net.ListenUDP("udp", addr)
	if err != nil {
		return nil, fmt.Errorf("bind udp: %w", err)
	}

	return &Server{
		config:  config,
		conn:    conn,
		clients: make(map[net.Conn]struct{}),
		stopCh:  make(chan struct{}),
		pending: make(map[string]chan []byte),
	}, nil
}

func (s *Server) Listen() error {
	var err error
	s.listener, err = net.Listen("tcp", s.config.ListenAddr)
	if err != nil {
		return fmt.Errorf("listen: %w", err)
	}

	go s.readUDP()

	go func() {
		for {
			conn, err := s.listener.Accept()
			if err != nil {
				select {
				case <-s.stopCh:
					return
				default:
					log.Printf("[edge-coap] Accept error: %v", err)
					continue
				}
			}
			s.mu.Lock()
			s.clients[conn] = struct{}{}
			s.mu.Unlock()
			log.Printf("[edge-coap] Client connected: %s", conn.RemoteAddr())
			go s.handleConn(conn)
		}
	}()

	return nil
}

func (s *Server) readUDP() {
	buf := make([]byte, 1500)
	for {
		n, remoteAddr, err := s.conn.ReadFromUDP(buf)
		if err != nil {
			select {
			case <-s.stopCh:
				return
			default:
				log.Printf("[edge-coap] UDP read error: %v", err)
				continue
			}
		}

		data := make([]byte, n)
		copy(data, buf[:n])

		// Check if this is a response to a pending request
		if len(data) >= 4 {
			msgID := uint16(data[2])<<8 | uint16(data[3])
			key := fmt.Sprintf("%s:%d:%d", remoteAddr.IP.String(), remoteAddr.Port, msgID)
			s.pendingMu.Lock()
			if ch, ok := s.pending[key]; ok {
				delete(s.pending, key)
				s.pendingMu.Unlock()
				select {
				case ch <- data:
				default:
				}
				continue
			}
			s.pendingMu.Unlock()
		}

		// Push to all connected clients
		msg := PushMessage{
			Type: "message",
			Host: remoteAddr.IP.String(),
			Port: remoteAddr.Port,
			Data: hex.EncodeToString(data),
		}
		s.broadcastPush(msg)
	}
}

func (s *Server) handleConn(conn net.Conn) {
	defer func() {
		s.mu.Lock()
		delete(s.clients, conn)
		s.mu.Unlock()
		conn.Close()
		log.Printf("[edge-coap] Client disconnected: %s", conn.RemoteAddr())
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

		data, err := hex.DecodeString(req.Data)
		if err != nil {
			s.writeResponse(conn, Response{ID: req.ID, OK: false, Error: fmt.Sprintf("invalid hex: %v", err)})
			continue
		}

		remoteAddr := &net.UDPAddr{IP: net.ParseIP(req.Host), Port: req.Port}

		// Extract message ID for correlation
		var msgID uint16
		if len(data) >= 4 {
			msgID = uint16(data[2])<<8 | uint16(data[3])
		}

		// Send the CoAP message
		_, err = s.conn.WriteToUDP(data, remoteAddr)
		if err != nil {
			s.writeResponse(conn, Response{ID: req.ID, OK: false, Error: fmt.Sprintf("send failed: %v", err)})
			continue
		}

		// Wait for response
		key := fmt.Sprintf("%s:%d:%d", req.Host, req.Port, msgID)
		ch := make(chan []byte, 1)
		s.pendingMu.Lock()
		s.pending[key] = ch
		s.pendingMu.Unlock()

		select {
		case respData := <-ch:
			s.writeResponse(conn, Response{ID: req.ID, OK: true, Data: hex.EncodeToString(respData)})
		case <-time.After(time.Duration(s.config.TimeoutMs) * time.Millisecond):
			s.pendingMu.Lock()
			delete(s.pending, key)
			s.pendingMu.Unlock()
			s.writeResponse(conn, Response{ID: req.ID, OK: false, Error: "request timed out"})
		}
	}
}

func (s *Server) broadcastPush(msg PushMessage) {
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
