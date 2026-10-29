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
	"strings"
	"sync"
	"time"

	"github.com/goburrow/modbus"
)

type Config struct {
	ListenAddr string `json:"listenAddr"`
	Mode       string `json:"mode"`       // "tcp" or "rtu"
	TCPAddr    string `json:"tcpAddr"`    // host:port for TCP mode
	SerialPort string `json:"serialPort"` // /dev/ttyUSB0 for RTU mode
	BaudRate   int    `json:"baudRate"`   // 9600, 19200, 38400, 115200
	DataBits   int    `json:"dataBits"`   // 8
	StopBits   int    `json:"stopBits"`   // 1
	Parity     string `json:"parity"`     // "N", "E", "O"
	TimeoutMs  int    `json:"timeoutMs"`  // per-request timeout
}

type Request struct {
	ID    string `json:"id"`
	Frame string `json:"frame"` // hex unit-prefixed PDU; no MBAP header or RTU CRC
}

type Response struct {
	ID    string `json:"id"`
	OK    bool   `json:"ok"`
	Frame string `json:"frame,omitempty"` // hex-encoded raw response
	Error string `json:"error,omitempty"`
}

type PushFrame struct {
	Type  string `json:"type"`  // "frame"
	Frame string `json:"frame"` // hex-encoded raw frame
}

type Server struct {
	config    Config
	handler   modbus.ClientHandler
	requestMu sync.Mutex // Protect unit selection and the entire exchange.
	mu        sync.RWMutex
	conns     map[net.Conn]struct{}
	listener  net.Listener
	stopCh    chan struct{}
}

func main() {
	config := Config{
		ListenAddr: getEnv("MODBUS_LISTEN_ADDR", "127.0.0.1:15002"),
		Mode:       getEnv("MODBUS_MODE", "tcp"),
		TCPAddr:    getEnv("MODBUS_TCP_ADDR", "127.0.0.1:502"),
		SerialPort: getEnv("MODBUS_SERIAL_PORT", "/dev/ttyUSB0"),
		BaudRate:   getEnvInt("MODBUS_BAUD_RATE", 9600),
		DataBits:   getEnvInt("MODBUS_DATA_BITS", 8),
		StopBits:   getEnvInt("MODBUS_STOP_BITS", 1),
		Parity:     getEnv("MODBUS_PARITY", "N"),
		TimeoutMs:  getEnvInt("MODBUS_TIMEOUT_MS", 2000),
	}

	srv, err := NewServer(config)
	if err != nil {
		log.Fatalf("[edge-modbus] Failed to create server: %v", err)
	}

	log.Printf("[edge-modbus] Starting Modbus transport")
	log.Printf("[edge-modbus] Mode: %s", config.Mode)
	if config.Mode == "tcp" {
		log.Printf("[edge-modbus] Target: %s", config.TCPAddr)
	} else {
		log.Printf("[edge-modbus] Port: %s, Baud: %d", config.SerialPort, config.BaudRate)
	}
	log.Printf("[edge-modbus] Listening on %s", config.ListenAddr)

	if err := srv.Listen(); err != nil {
		log.Fatalf("[edge-modbus] Failed to start: %v", err)
	}

	select {}
}

func NewServer(config Config) (*Server, error) {
	handler, err := createHandler(config)
	if err != nil {
		return nil, fmt.Errorf("create handler: %w", err)
	}

	return &Server{
		config:  config,
		handler: handler,
		conns:   make(map[net.Conn]struct{}),
		stopCh:  make(chan struct{}),
	}, nil
}

func createHandler(config Config) (modbus.ClientHandler, error) {
	switch strings.ToLower(config.Mode) {
	case "tcp":
		handler := modbus.NewTCPClientHandler(config.TCPAddr)
		handler.Timeout = time.Duration(config.TimeoutMs) * time.Millisecond
		return handler, nil
	case "rtu":
		handler := modbus.NewRTUClientHandler(config.SerialPort)
		handler.BaudRate = config.BaudRate
		handler.DataBits = config.DataBits
		handler.StopBits = config.StopBits
		handler.Parity = config.Parity
		handler.Timeout = time.Duration(config.TimeoutMs) * time.Millisecond
		return handler, nil
	default:
		return nil, fmt.Errorf("unsupported mode: %s (use 'tcp' or 'rtu')", config.Mode)
	}
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
					log.Printf("[edge-modbus] Accept error: %v", err)
					continue
				}
			}
			s.mu.Lock()
			s.conns[conn] = struct{}{}
			s.mu.Unlock()
			log.Printf("[edge-modbus] Client connected: %s", conn.RemoteAddr())
			go s.handleConn(conn)
		}
	}()

	return nil
}

func (s *Server) handleConn(conn net.Conn) {
	defer func() {
		s.mu.Lock()
		delete(s.conns, conn)
		s.mu.Unlock()
		conn.Close()
		log.Printf("[edge-modbus] Client disconnected: %s", conn.RemoteAddr())
	}()

	scanner := bufio.NewScanner(conn)
	scanner.Buffer(make([]byte, 1024*1024), 1024*1024)

	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" {
			continue
		}

		var req Request
		if err := json.Unmarshal([]byte(line), &req); err != nil {
			s.writeResponse(conn, Response{ID: "", OK: false, Error: fmt.Sprintf("invalid json: %v", err)})
			continue
		}

		if req.Frame == "" {
			s.writeResponse(conn, Response{ID: req.ID, OK: false, Error: "missing frame field"})
			continue
		}

		frameBytes, err := hex.DecodeString(req.Frame)
		if err != nil {
			s.writeResponse(conn, Response{ID: req.ID, OK: false, Error: fmt.Sprintf("invalid hex frame: %v", err)})
			continue
		}

		respBytes, err := s.sendRawFrame(frameBytes)
		if err != nil {
			s.writeResponse(conn, Response{ID: req.ID, OK: false, Error: err.Error()})
			continue
		}

		s.writeResponse(conn, Response{ID: req.ID, OK: true, Frame: hex.EncodeToString(respBytes)})
	}

	if err := scanner.Err(); err != nil {
		log.Printf("[edge-modbus] Scanner error: %v", err)
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
