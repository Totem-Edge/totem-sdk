package main

import (
	"bufio"
	"encoding/binary"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"net"
	"os"
	"strconv"
	"sync"
	"syscall"
	"unsafe"
)

type Config struct {
	ListenAddr    string `json:"listenAddr"`
	InterfaceName string `json:"interfaceName"`
}

type Request struct {
	ID         string `json:"id"`
	Type       string `json:"type"` // "open", "close", "send"
	Interface  string `json:"interface,omitempty"`
	CanID      uint32 `json:"canId,omitempty"`
	IsExtended bool   `json:"isExtended,omitempty"`
	Data       string `json:"data,omitempty"` // hex-encoded
}

type Response struct {
	ID    string `json:"id"`
	OK    bool   `json:"ok"`
	Error string `json:"error,omitempty"`
}

type PushFrame struct {
	Type       string `json:"type"` // "frame"
	ID         uint32 `json:"id"`
	IsExtended bool   `json:"isExtended"`
	IsRtr      bool   `json:"isRtr"`
	DLC        uint8  `json:"dlc"`
	Data       string `json:"data"` // hex-encoded
	Timestamp  int64  `json:"timestamp"`
}

type Server struct {
	config   Config
	sockFD   int
	mu       sync.RWMutex
	clients  map[net.Conn]struct{}
	listener net.Listener
	stopCh   chan struct{}
}

func main() {
	config := Config{
		ListenAddr:    getEnv("CAN_LISTEN_ADDR", "127.0.0.1:15004"),
		InterfaceName: getEnv("CAN_INTERFACE", "can0"),
	}

	srv := &Server{
		config:  config,
		clients: make(map[net.Conn]struct{}),
		stopCh:  make(chan struct{}),
	}

	log.Printf("[edge-can] Starting CAN transport")
	log.Printf("[edge-can] Interface: %s", config.InterfaceName)
	log.Printf("[edge-can] Listening on %s", config.ListenAddr)

	if err := srv.Listen(); err != nil {
		log.Fatalf("[edge-can] Failed to start: %v", err)
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
					log.Printf("[edge-can] Accept error: %v", err)
					continue
				}
			}
			s.mu.Lock()
			s.clients[conn] = struct{}{}
			s.mu.Unlock()
			log.Printf("[edge-can] Client connected: %s", conn.RemoteAddr())
			go s.handleConn(conn)
		}
	}()

	return nil
}

func (s *Server) openCAN(ifname string) error {
	if s.sockFD > 0 {
		syscall.Close(s.sockFD)
	}

	fd, err := syscall.Socket(syscall.AF_CAN, syscall.SOCK_RAW, 1) // CAN_RAW
	if err != nil {
		return fmt.Errorf("socket: %w", err)
	}

	ifIndex, err := getIfIndex(fd, ifname)
	if err != nil {
		syscall.Close(fd)
		return fmt.Errorf("get ifindex for %s: %w", ifname, err)
	}

	addr := &syscall.SockaddrLinklayer{
		Protocol: syscall.ETH_P_CAN,
		Ifindex:  ifIndex,
	}
	if err := syscall.Bind(fd, addr); err != nil {
		syscall.Close(fd)
		return fmt.Errorf("bind: %w", err)
	}

	s.sockFD = fd
	log.Printf("[edge-can] Opened interface %s (fd=%d)", ifname, fd)

	go s.readCAN()
	return nil
}

func (s *Server) readCAN() {
	buf := make([]byte, 16) // CAN frame = 16 bytes on Linux
	for {
		n, _, err := syscall.Recvfrom(s.sockFD, buf, 0)
		if err != nil {
			select {
			case <-s.stopCh:
				return
			default:
				log.Printf("[edge-can] Read error: %v", err)
				continue
			}
		}

		if n < 16 {
			continue
		}

		canID := binary.LittleEndian.Uint32(buf[0:4])
		dlc := buf[4]
		flags := buf[5]
		isExtended := (canID & 0x80000000) != 0
		isRtr := (flags & 0x40) != 0

		// Mask off EFF/RTR/ERR flags
		id := canID & 0x1FFFFFFF

		frame := PushFrame{
			Type:       "frame",
			ID:         id,
			IsExtended: isExtended,
			IsRtr:      isRtr,
			DLC:        dlc & 0x0F,
			Data:       hex.EncodeToString(buf[8 : 8+int(dlc&0x0F)]),
			Timestamp:  time.Now().UnixMilli(),
		}

		s.broadcastPush(frame)
	}
}

func (s *Server) sendCAN(id uint32, data []byte, isExtended bool) error {
	if s.sockFD <= 0 {
		return fmt.Errorf("CAN interface not open")
	}

	canID := id & 0x1FFFFFFF
	if isExtended {
		canID |= 0x80000000
	}

	frame := make([]byte, 16)
	binary.LittleEndian.PutUint32(frame[0:4], canID)
	frame[4] = uint8(len(data))
	copy(frame[8:], data)

	_, err := syscall.Write(s.sockFD, frame)
	return err
}

func (s *Server) handleConn(conn net.Conn) {
	defer func() {
		s.mu.Lock()
		delete(s.clients, conn)
		s.mu.Unlock()
		conn.Close()
		log.Printf("[edge-can] Client disconnected: %s", conn.RemoteAddr())
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
		case "open":
			ifname := req.Interface
			if ifname == "" {
				ifname = s.config.InterfaceName
			}
			if err := s.openCAN(ifname); err != nil {
				s.writeResponse(conn, Response{ID: req.ID, OK: false, Error: err.Error()})
			} else {
				s.writeResponse(conn, Response{ID: req.ID, OK: true})
			}

		case "close":
			if s.sockFD > 0 {
				syscall.Close(s.sockFD)
				s.sockFD = 0
			}
			s.writeResponse(conn, Response{ID: req.ID, OK: true})

		case "send":
			data, err := hex.DecodeString(req.Data)
			if err != nil {
				s.writeResponse(conn, Response{ID: req.ID, OK: false, Error: fmt.Sprintf("invalid hex: %v", err)})
				continue
			}
			if err := s.sendCAN(req.CanID, data, req.IsExtended); err != nil {
				s.writeResponse(conn, Response{ID: req.ID, OK: false, Error: err.Error()})
			} else {
				s.writeResponse(conn, Response{ID: req.ID, OK: true})
			}

		default:
			s.writeResponse(conn, Response{ID: req.ID, OK: false, Error: fmt.Sprintf("unknown request type: %s", req.Type)})
		}
	}
}

func (s *Server) broadcastPush(frame PushFrame) {
	data, _ := json.Marshal(frame)
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

func getIfIndex(fd int, ifname string) (int, error) {
	var ifreq [40]byte
	copy(ifreq[:], ifname)
	_, _, errno := syscall.Syscall(syscall.SYS_IOCTL, uintptr(fd), syscall.SIOCGIFINDEX, uintptr(unsafe.Pointer(&ifreq[0])))
	if errno != 0 {
		return 0, errno
	}
	return int(binary.LittleEndian.Uint32(ifreq[16:20])), nil
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

func init() {
	_ = time.Now
}
