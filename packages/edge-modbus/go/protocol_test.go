package main

import (
	"bytes"
	"encoding/binary"
	"fmt"
	"io"
	"net"
	"sync"
	"testing"
	"time"

	"github.com/goburrow/modbus"
)

// Exercises the real library's TCP encode/send/verify/decode path on loopback.
// The simulator supplies complete device PDUs, not high-level client return values.
func simulator(t *testing.T, respond func([]byte) []byte) *Server {
	t.Helper()
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	server, err := NewServer(Config{Mode: "tcp", TCPAddr: listener.Addr().String(), TimeoutMs: 500})
	if err != nil {
		t.Fatal(err)
	}
	finished := make(chan struct{})
	go func() {
		defer close(finished)
		conn, err := listener.Accept()
		if err != nil {
			return
		}
		defer conn.Close()
		for {
			_ = conn.SetDeadline(time.Now().Add(3 * time.Second))
			header := make([]byte, 7)
			if _, err := io.ReadFull(conn, header); err != nil {
				return
			}
			length := int(binary.BigEndian.Uint16(header[4:6]))
			if length < 2 || length > 254 {
				return
			}
			pdu := make([]byte, length-1)
			if _, err := io.ReadFull(conn, pdu); err != nil {
				return
			}
			request := append([]byte{header[6]}, pdu...)
			response := respond(request)
			if response == nil {
				return
			} // Simulate connection loss after a request.
			binary.BigEndian.PutUint16(header[4:6], uint16(len(response)))
			header[6] = response[0]
			if _, err := conn.Write(append(header, response[1:]...)); err != nil {
				return
			}
		}
	}()
	t.Cleanup(func() {
		_ = server.handler.(*modbus.TCPClientHandler).Close()
		_ = listener.Close()
		select {
		case <-finished:
		case <-time.After(4 * time.Second):
			t.Error("simulator did not stop")
		}
	})
	return server
}

func TestTCPProtocolResponses(t *testing.T) {
	cases := []struct {
		name              string
		request, response []byte
	}{
		{"coils", []byte{7, 1, 0, 10, 0, 4}, []byte{7, 1, 1, 0x0a}},
		{"discrete", []byte{7, 2, 0, 10, 0, 9}, []byte{7, 2, 2, 1, 1}},
		{"holding", []byte{7, 3, 0, 10, 0, 2}, []byte{7, 3, 4, 1, 2, 3, 4}},
		{"input", []byte{7, 4, 0, 10, 0, 1}, []byte{7, 4, 2, 0xab, 0xcd}},
		{"single-coil", []byte{7, 5, 0, 10, 0xff, 0}, []byte{7, 5, 0, 10, 0xff, 0}},
		{"single-register", []byte{7, 6, 0, 10, 0x12, 0x34}, []byte{7, 6, 0, 10, 0x12, 0x34}},
		{"multi-coil", []byte{7, 15, 0, 10, 0, 9, 2, 1, 1}, []byte{7, 15, 0, 10, 0, 9}},
		{"multi-register", []byte{7, 16, 0, 10, 0, 2, 4, 1, 2, 3, 4}, []byte{7, 16, 0, 10, 0, 2}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			s := simulator(t, func(request []byte) []byte {
				if !bytes.Equal(request, tc.request) {
					t.Errorf("wire request %x != %x", request, tc.request)
				}
				return tc.response
			})
			response, err := s.sendRawFrame(tc.request)
			if err != nil {
				t.Fatal(err)
			}
			if !bytes.Equal(response, tc.response) {
				t.Fatalf("response %x != %x", response, tc.response)
			}
		})
	}
}

func TestTCPRejectsMalformedResponses(t *testing.T) {
	read := []byte{7, 3, 0, 10, 0, 1}
	write := []byte{7, 6, 0, 10, 0x12, 0x34}
	cases := []struct {
		name              string
		request, response []byte
	}{
		{"wrong-unit", read, []byte{8, 3, 2, 0, 1}},
		{"wrong-function", read, []byte{7, 4, 2, 0, 1}},
		{"no-byte-count", read, []byte{7, 3, 0, 1}},
		{"truncated-data", read, []byte{7, 3, 2, 1}},
		{"excess-data", read, []byte{7, 3, 2, 0, 1, 0}},
		{"exception", read, []byte{7, 0x83, 2}},
		{"empty-exception", read, []byte{7, 0x83}},
		{"wrong-write-address", write, []byte{7, 6, 0, 11, 0x12, 0x34}},
		{"wrong-write-value", write, []byte{7, 6, 0, 10, 0x12, 0x35}},
		{"truncated-write-ack", write, []byte{7, 6, 0, 10}},
		{"lost-write-ack", write, nil},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			s := simulator(t, func([]byte) []byte { return tc.response })
			if response, err := s.sendRawFrame(tc.request); err == nil || response != nil {
				t.Fatalf("accepted invalid response %x: %v", response, err)
			}
		})
	}
}

func TestConcurrentUnitRouting(t *testing.T) {
	s := simulator(t, func(request []byte) []byte {
		// Echo the actual wire unit in its register value. A unit-selection race
		// will then disagree with the value requested by that goroutine.
		return []byte{request[0], 3, 2, 0, request[0]}
	})
	var wg sync.WaitGroup
	errors := make(chan error, 32)
	for unit := byte(1); unit <= 32; unit++ {
		wg.Add(1)
		go func(unit byte) {
			defer wg.Done()
			response, err := s.sendRawFrame([]byte{unit, 3, 0, 0, 0, 1})
			if err != nil {
				errors <- err
				return
			}
			if !bytes.Equal(response, []byte{unit, 3, 2, 0, unit}) {
				errors <- fmt.Errorf("unit %d got %x", unit, response)
			}
		}(unit)
	}
	wg.Wait()
	close(errors)
	for err := range errors {
		t.Error(err)
	}
}

func TestInvalidRequestsFailBeforeTransport(t *testing.T) {
	requests := [][]byte{
		nil, {1}, {1, 15, 0, 0, 0, 1}, {1, 16, 0, 0, 0, 1, 2, 0},
		{0, 3, 0, 0, 0, 1}, {248, 3, 0, 0, 0, 1}, {1, 3, 0, 0, 0, 0},
		{1, 3, 0, 0, 0, 126}, {1, 3, 255, 255, 0, 2},
		{1, 5, 0, 0, 0, 1}, {1, 3, 0, 0, 0, 1, 0, 0},
		{1, 15, 0, 0, 0, 0, 0}, {1, 16, 0, 0, 0, 1, 1, 0},
	}
	// No handler: malformed requests must return before touching transport state.
	s := &Server{}
	for _, request := range requests {
		if _, err := s.sendRawFrame(request); err == nil {
			t.Errorf("accepted %x", request)
		}
	}
}

func FuzzValidateRequest(f *testing.F) {
	f.Add([]byte{1, 15, 0, 0, 0, 1})
	f.Add([]byte{1, 16, 0, 0, 0, 1, 2, 0, 1})
	f.Fuzz(func(t *testing.T, frame []byte) { _ = validateRequest(frame) })
}
