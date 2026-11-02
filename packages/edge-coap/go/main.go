package main

import (
	"bufio"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net"
	"os"
	"os/signal"
	"sync"
	"syscall"
)

type Config struct {
	ListenAddr string `json:"listenAddr"`
	BindPort   int    `json:"bindPort"`
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
	Error string `json:"error,omitempty"`
}

type PushMessage struct {
	Type  string `json:"type"` // "message" | "error"
	Host  string `json:"host,omitempty"`
	Port  int    `json:"port,omitempty"`
	Data  string `json:"data,omitempty"`
	Code  string `json:"code,omitempty"`
	Error string `json:"error,omitempty"`
}

type Server struct {
	config Config

	conn      *net.UDPConn
	mu        sync.Mutex
	clients   map[net.Conn]struct{}
	listener  net.Listener
	stopCh    chan struct{}
	closeOnce sync.Once
}

func main() {
	if len(os.Args) > 1 && (os.Args[1] == "--version" || os.Args[1] == "-version") {
		fmt.Printf("edge-coap protocol=%d\n", protocolVersion)
		return
	}

	config := Config{
		ListenAddr: getEnv("COAP_LISTEN_ADDR", "127.0.0.1:15003"),
		BindPort:   getEnvInt("COAP_BIND_PORT", 5683),
	}

	srv, err := NewServer(config)
	if err != nil {
		log.Fatalf("[edge-coap] Failed to create server: %v", err)
	}

	log.Printf("[edge-coap] Starting CoAP transport")
	log.Printf("[edge-coap] UDP bind port: %d", srv.LocalPort())
	log.Printf("[edge-coap] Listening on %s", config.ListenAddr)

	if err := srv.Listen(); err != nil {
		log.Fatalf("[edge-coap] Failed to start: %v", err)
	}

	signals := make(chan os.Signal, 1)
	signal.Notify(signals, syscall.SIGINT, syscall.SIGTERM)
	<-signals
	srv.Shutdown()
}

func NewServer(config Config) (*Server, error) {
	conn, err := net.ListenUDP("udp", &net.UDPAddr{Port: config.BindPort})
	if err != nil {
		return nil, fmt.Errorf("bind udp: %w", err)
	}

	return &Server{
		config:  config,
		conn:    conn,
		clients: make(map[net.Conn]struct{}),
		stopCh:  make(chan struct{}),
	}, nil
}

func (s *Server) LocalPort() int {
	if s.conn == nil {
		return 0
	}
	return s.conn.LocalAddr().(*net.UDPAddr).Port
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

func (s *Server) Shutdown() {
	s.closeOnce.Do(func() {
		close(s.stopCh)
		if s.listener != nil {
			_ = s.listener.Close()
		}
		if s.conn != nil {
			_ = s.conn.Close()
		}
		s.mu.Lock()
		clients := make([]net.Conn, 0, len(s.clients))
		for conn := range s.clients {
			clients = append(clients, conn)
		}
		s.clients = make(map[net.Conn]struct{})
		s.mu.Unlock()
		for _, conn := range clients {
			_ = conn.Close()
		}
	})
}

// readUDP is a thin bridge: every inbound datagram is pushed to connected
// clients. Correlation and retransmission belong to the TypeScript gateway,
// which owns the token/match state.
func (s *Server) readUDP() {
	buf := make([]byte, maxDatagram)
	for {
		n, remoteAddr, err := s.conn.ReadFromUDP(buf)
		if err != nil {
			select {
			case <-s.stopCh:
				return
			default:
			}
			if errors.Is(err, net.ErrClosed) {
				return
			}
			s.broadcast(PushMessage{Type: "error", Code: "read", Error: err.Error()})
			continue
		}

		data := make([]byte, n)
		copy(data, buf[:n])
		s.broadcast(PushMessage{
			Type: "message",
			Host: remoteAddr.IP.String(),
			Port: remoteAddr.Port,
			Data: hex.EncodeToString(data),
		})
	}
}

func (s *Server) handleConn(conn net.Conn) {
	defer func() {
		s.mu.Lock()
		delete(s.clients, conn)
		s.mu.Unlock()
		_ = conn.Close()
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
		if err := validateTarget(req.Host, req.Port, data); err != nil {
			s.writeResponse(conn, Response{ID: req.ID, OK: false, Error: err.Error()})
			continue
		}

		remoteAddr := &net.UDPAddr{IP: net.ParseIP(req.Host), Port: req.Port}
		if _, err := s.conn.WriteToUDP(data, remoteAddr); err != nil {
			s.writeResponse(conn, Response{ID: req.ID, OK: false, Error: fmt.Sprintf("send failed: %v", err)})
			continue
		}
		// Fire-and-forget: the response arrives asynchronously as a pushed
		// message and is correlated by the gateway's token.
		s.writeResponse(conn, Response{ID: req.ID, OK: true})
	}
}

func (s *Server) broadcast(msg PushMessage) {
	data, err := json.Marshal(msg)
	if err != nil {
		return
	}
	data = append(data, '\n')

	s.mu.Lock()
	defer s.mu.Unlock()
	for conn := range s.clients {
		_, _ = conn.Write(data)
	}
}

func (s *Server) writeResponse(conn net.Conn, resp Response) {
	data, err := json.Marshal(resp)
	if err != nil {
		return
	}
	data = append(data, '\n')
	_, _ = conn.Write(data)
}

func getEnv(key, defaultVal string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return defaultVal
}

func getEnvInt(key string, defaultVal int) int {
	if v := os.Getenv(key); v != "" {
		var i int
		if _, err := fmt.Sscanf(v, "%d", &i); err == nil {
			return i
		}
	}
	return defaultVal
}
