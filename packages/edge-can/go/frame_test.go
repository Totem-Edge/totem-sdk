package main

import (
	"encoding/binary"
	"strings"
	"testing"
)

func classicFrame(id uint32, dlc byte, data ...byte) []byte {
	buf := make([]byte, classicFrameSize)
	binary.LittleEndian.PutUint32(buf[0:4], id)
	buf[4] = dlc
	copy(buf[8:], data)
	return buf
}

func TestDecodeClassicFrameStandard(t *testing.T) {
	frame, err := decodeClassicFrame(classicFrame(0x123, 2, 0xaa, 0xbb), 1000)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if frame.ID != 0x123 || frame.IsExtended || frame.IsRtr {
		t.Fatalf("unexpected identity: %+v", frame)
	}
	if frame.DLC != 2 || frame.Data != "aabb" {
		t.Fatalf("unexpected payload: %+v", frame)
	}
	if frame.Timestamp != 1000 {
		t.Fatalf("timestamp not carried: %+v", frame)
	}
}

func TestDecodeClassicFrameExtended(t *testing.T) {
	frame, err := decodeClassicFrame(classicFrame(0x1abcdef|canEffFlag, 8, 1, 2, 3, 4, 5, 6, 7, 8), 1)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !frame.IsExtended {
		t.Fatal("extended flag not detected")
	}
	if frame.ID != 0x1abcdef {
		t.Fatalf("extended ID not masked: %x", frame.ID)
	}
	if frame.Data != "0102030405060708" {
		t.Fatalf("unexpected payload: %s", frame.Data)
	}
}

func TestDecodeClassicFrameRemoteRequest(t *testing.T) {
	frame, err := decodeClassicFrame(classicFrame(0x321|canRtrFlag, 4, 0, 0, 0, 0), 1)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !frame.IsRtr {
		t.Fatal("RTR flag not detected")
	}
	if frame.DLC != 4 {
		t.Fatalf("RTR requested length lost: %d", frame.DLC)
	}
	if frame.Data != "" {
		t.Fatalf("RTR frame must not carry data: %q", frame.Data)
	}
}

func TestDecodeClassicFrameRejectsUnsupportedDLC(t *testing.T) {
	if _, err := decodeClassicFrame(classicFrame(0x123, 9), 1); err == nil {
		t.Fatal("expected DLC 9 to be rejected")
	}
}

func TestDecodeClassicFrameRejectsCANFD(t *testing.T) {
	if _, err := decodeClassicFrame(make([]byte, canFDFrameSize), 1); err == nil {
		t.Fatal("expected a CAN FD frame to be rejected")
	}
}

func TestDecodeClassicFrameRejectsShortFrame(t *testing.T) {
	if _, err := decodeClassicFrame(make([]byte, classicFrameSize-1), 1); err == nil {
		t.Fatal("expected a short frame to be rejected")
	}
}

func TestDecodeClassicFrameDetectsBusOff(t *testing.T) {
	frame, err := decodeClassicFrame(classicFrame(canErrFlag|canErrBusoff, 0), 1)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !frame.IsError {
		t.Fatal("error frame not detected")
	}
	if frame.ErrorClass&canErrBusoff == 0 {
		t.Fatalf("bus-off class lost: 0x%08x", frame.ErrorClass)
	}
}

func TestValidateSend(t *testing.T) {
	tests := []struct {
		name     string
		id       uint32
		extended bool
		data     []byte
		wantErr  string
	}{
		{name: "classic max id", id: 0x7ff},
		{name: "classic id too large", id: 0x800, wantErr: "11-bit CAN ID"},
		{name: "extended id", id: 0x1fffffff, extended: true},
		{name: "extended id too large", id: 0x20000000, extended: true, wantErr: "29-bit CAN ID"},
		{name: "eight byte payload", id: 1, data: make([]byte, 8)},
		{name: "nine byte payload", id: 1, data: make([]byte, 9), wantErr: "0-8 bytes"},
		{name: "empty payload", id: 0, data: nil},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			err := validateSend(test.id, test.extended, test.data)
			if test.wantErr == "" {
				if err != nil {
					t.Fatalf("unexpected error: %v", err)
				}
				return
			}
			if err == nil || !strings.Contains(err.Error(), test.wantErr) {
				t.Fatalf("expected error containing %q, got %v", test.wantErr, err)
			}
		})
	}
}
