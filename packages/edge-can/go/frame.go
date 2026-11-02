package main

import (
	"encoding/binary"
	"encoding/hex"
	"errors"
	"fmt"
)

// Linux CAN constants from <linux/can.h>. The stdlib syscall package does not
// export all of them. Kept platform-neutral so frame parsing is testable
// anywhere; only the socket code is Linux-specific.
const (
	canErrFlag   = 0x20000000
	canEffFlag   = 0x80000000
	canRtrFlag   = 0x40000000
	canErrBusoff = 0x00000040

	classicFrameSize = 16
	canFDFrameSize   = 72
	maxClassicID     = 0x7ff
	maxExtendedID    = 0x1fffffff
	maxClassicData   = 8
)

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
	IsError    bool   `json:"isError,omitempty"`
	ErrorClass uint32 `json:"errorClass,omitempty"`
}

type PushError struct {
	Type      string `json:"type"` // "error"
	Code      string `json:"code"`
	Error     string `json:"error"`
	Timestamp int64  `json:"timestamp"`
}

// decodeClassicFrame parses a Linux struct can_frame without trusting its DLC.
func decodeClassicFrame(buf []byte, now int64) (PushFrame, error) {
	if len(buf) >= canFDFrameSize {
		return PushFrame{}, errors.New("CAN FD frames are not supported by this profile")
	}
	if len(buf) < classicFrameSize {
		return PushFrame{}, fmt.Errorf("short CAN frame: %d bytes", len(buf))
	}

	rawID := binary.LittleEndian.Uint32(buf[0:4])
	if rawID&canErrFlag != 0 {
		return PushFrame{IsError: true, ErrorClass: rawID & 0x1fffffff, Timestamp: now}, nil
	}

	dlc := buf[4]
	if dlc > maxClassicData {
		return PushFrame{}, fmt.Errorf("unsupported classic CAN DLC %d", dlc)
	}

	// RTR is a can_id flag; buf[5] is padding, not the RTR bit.
	isRtr := rawID&canRtrFlag != 0
	data := buf[8 : 8+int(dlc)]
	if isRtr {
		data = nil
	}

	return PushFrame{
		Type:       "frame",
		ID:         rawID & maxExtendedID,
		IsExtended: rawID&canEffFlag != 0,
		IsRtr:      isRtr,
		DLC:        dlc,
		Data:       hex.EncodeToString(data),
		Timestamp:  now,
	}, nil
}

func validateSend(id uint32, extended bool, data []byte) error {
	maxID := uint32(maxClassicID)
	if extended {
		maxID = maxExtendedID
	}
	if id > maxID {
		return fmt.Errorf("invalid %s CAN ID %d", map[bool]string{true: "29-bit", false: "11-bit"}[extended], id)
	}
	if len(data) > maxClassicData {
		return fmt.Errorf("classic CAN payload must be 0-%d bytes, got %d", maxClassicData, len(data))
	}
	return nil
}
