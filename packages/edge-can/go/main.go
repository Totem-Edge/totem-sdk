//go:build linux

package main

import (
	"bufio"
	"encoding/binary"
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
	"time"
	"unsafe"
)

type Config struct {
	ListenAddr    string `json:"listenAddr"`
	InterfaceName string `json:"interfaceName"`
}

const protocolVersion = 1

type Server struct {
	config Config

	mu         sync.Mutex
	sockFD     int
	ifname     string
	generation uint64
	recovering bool
	clients    map[net.Conn]struct{}
	listener   net.Listener
	stopCh     chan struct{}
	closeOnce  sync.Once
}

func main() {
	if len(os.Args) > 1 && (os.Args[1] == "--version" || os.Args[1] == "-version") {
		fmt.Printf("edge-can protocol=%d\n", protocolVersion)
		return
	}

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

func (s *Server) Shutdown() {
	s.closeOnce.Do(func() {
		close(s.stopCh)
		if s.listener != nil {
			_ = s.listener.Close()
		}
		s.mu.Lock()
		s.closeInterfaceLocked()
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

func (s *Server) openCAN(ifname string) error {
	if ifname == "" {
		return errors.New("interface name required")
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

	if err := bindCAN(fd, ifIndex); err != nil {
		syscall.Close(fd)
		return fmt.Errorf("bind: %w", err)
	}

	// Non-blocking reads let a close/reopen interrupt the reader without relying
	// on close() waking a blocked recvfrom on another thread.
	if err := syscall.SetNonblock(fd, true); err != nil {
		syscall.Close(fd)
		return fmt.Errorf("set nonblock: %w", err)
	}

	s.mu.Lock()
	s.closeInterfaceLocked()
	s.sockFD = fd
	s.ifname = ifname
	s.generation++
	generation := s.generation
	s.mu.Unlock()

	log.Printf("[edge-can] Opened interface %s (fd=%d, generation=%d)", ifname, fd, generation)
	go s.readCAN(generation, fd, ifname)
	return nil
}

func (s *Server) closeInterface() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.closeInterfaceLocked()
}

// closeInterfaceLocked must be called with s.mu held.
func (s *Server) closeInterfaceLocked() {
	if s.sockFD > 0 {
		s.generation++
		_ = syscall.Close(s.sockFD)
		s.sockFD = 0
		s.ifname = ""
	}
}

func (s *Server) isCurrent(generation uint64, fd int) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.generation == generation && s.sockFD == fd
}

func (s *Server) readCAN(generation uint64, fd int, ifname string) {
	// A CAN FD frame is a 72-byte canfd_frame; reading it into a 16-byte buffer
	// would truncate the header and could slice past the buffer. Size for FD so
	// unsupported frames are reported instead of panicking.
	buf := make([]byte, canFDFrameSize)
	for {
		if !s.isCurrent(generation, fd) {
			return
		}

		n, _, err := syscall.Recvfrom(fd, buf, 0)
		if err != nil {
			if errors.Is(err, syscall.EINTR) {
				continue
			}
			if errors.Is(err, syscall.EAGAIN) || errors.Is(err, syscall.EWOULDBLOCK) {
				time.Sleep(20 * time.Millisecond)
				continue
			}
			if !s.isCurrent(generation, fd) {
				return
			}
			// A transient link error (for example the interface was set down)
			// must not turn into a busy loop.
			log.Printf("[edge-can] read error: %v", err)
			s.broadcastError("read", err.Error())
			time.Sleep(100 * time.Millisecond)
			continue
		}
		if n == 0 {
			continue
		}

		if n >= canFDFrameSize {
			s.broadcastError("frame", "CAN FD frames are not supported by this profile")
			continue
		}

		frame, err := decodeClassicFrame(buf[:n], time.Now().UnixMilli())
		if err != nil {
			log.Printf("[edge-can] decode error: %v", err)
			s.broadcastError("frame", err.Error())
			continue
		}
		if frame.IsError {
			s.handleErrorFrame(generation, ifname, frame)
			continue
		}
		if os.Getenv("CAN_DEBUG") == "1" {
			log.Printf("[edge-can] frame id=0x%x ext=%v rtr=%v dlc=%d", frame.ID, frame.IsExtended, frame.IsRtr, frame.DLC)
		}
		s.broadcastPush(frame)
	}
}

func (s *Server) handleErrorFrame(generation uint64, ifname string, frame PushFrame) {
	code := "bus-error"
	if frame.ErrorClass&canErrBusoff != 0 {
		code = "bus-off"
	}
	s.broadcastError(code, fmt.Sprintf("CAN error frame class=0x%08x", frame.ErrorClass))
	if code == "bus-off" {
		go s.recoverBus(generation, ifname)
	}
}

func (s *Server) recoverBus(generation uint64, ifname string) {
	s.mu.Lock()
	if s.recovering || s.generation != generation {
		s.mu.Unlock()
		return
	}
	s.recovering = true
	s.mu.Unlock()

	defer func() {
		s.mu.Lock()
		s.recovering = false
		s.mu.Unlock()
	}()

	// Give the controller time to leave bus-off before reopening.
	time.Sleep(time.Second)

	s.mu.Lock()
	stillCurrent := s.generation == generation
	s.mu.Unlock()
	if !stillCurrent {
		return
	}

	if err := s.openCAN(ifname); err != nil {
		s.broadcastError("bus-off", fmt.Sprintf("reopen %s failed: %v", ifname, err))
		return
	}
	log.Printf("[edge-can] Reopened %s after bus-off", ifname)
}

func (s *Server) sendCAN(id uint32, data []byte, isExtended bool) error {
	if err := validateSend(id, isExtended, data); err != nil {
		return err
	}

	s.mu.Lock()
	fd := s.sockFD
	s.mu.Unlock()
	if fd <= 0 {
		return errors.New("CAN interface not open")
	}

	canID := id
	if isExtended {
		canID |= canEffFlag
	}

	frame := make([]byte, classicFrameSize)
	binary.LittleEndian.PutUint32(frame[0:4], canID)
	frame[4] = uint8(len(data))
	copy(frame[8:], data)

	if _, err := syscall.Write(fd, frame); err != nil {
		if errors.Is(err, syscall.EAGAIN) {
			return errors.New("CAN send buffer full")
		}
		return err
	}
	return nil
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
			s.closeInterface()
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
	s.broadcastJSON(frame)
}

func (s *Server) broadcastError(code, message string) {
	s.broadcastJSON(PushError{Type: "error", Code: code, Error: message, Timestamp: time.Now().UnixMilli()})
}

func (s *Server) broadcastJSON(value any) {
	data, err := json.Marshal(value)
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

// sockaddrCAN is Linux's struct sockaddr_can. Go's SockaddrLinklayer cannot be
// used for AF_CAN: syscall.Bind fills sa_family from the Go type, and
// SockaddrLinklayer sets AF_PACKET, so the kernel rejects the bind with EINVAL.
type sockaddrCAN struct {
	Family   uint16
	_        uint16
	Ifindex  int32
	RxID     uint32
	TxID     uint32
	RxIDMask uint32
	TxIDMask uint32
}

func bindCAN(fd int, ifIndex int) error {
	addr := sockaddrCAN{Family: syscall.AF_CAN, Ifindex: int32(ifIndex)}
	_, _, errno := syscall.Syscall(
		syscall.SYS_BIND,
		uintptr(fd),
		uintptr(unsafe.Pointer(&addr)),
		unsafe.Sizeof(addr),
	)
	if errno != 0 {
		return errno
	}
	return nil
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
