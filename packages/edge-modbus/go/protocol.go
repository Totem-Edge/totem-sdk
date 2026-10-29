package main

import (
	"bytes"
	"encoding/binary"
	"fmt"

	"github.com/goburrow/modbus"
)

// sendRawFrame exchanges a unit-prefixed PDU. The library owns wire framing;
// return the actual validated PDU, never an acknowledgement fabricated from input.
func (s *Server) sendRawFrame(frame []byte) ([]byte, error) {
	if err := validateRequest(frame); err != nil {
		return nil, err
	}
	s.requestMu.Lock()
	defer s.requestMu.Unlock()
	minimumResponse := 0
	switch handler := s.handler.(type) {
	case *modbus.TCPClientHandler:
		handler.SlaveId = frame[0]
		minimumResponse = 8
	case *modbus.RTUClientHandler:
		handler.SlaveId = frame[0]
		minimumResponse = 5
	default:
		return nil, fmt.Errorf("unsupported Modbus handler")
	}
	request, err := s.handler.Encode(&modbus.ProtocolDataUnit{FunctionCode: frame[1], Data: frame[2:]})
	if err != nil {
		return nil, err
	}
	response, err := s.handler.Send(request)
	if err != nil {
		return nil, err
	}
	if len(response) < minimumResponse {
		return nil, fmt.Errorf("truncated Modbus wire response")
	}
	if err := s.handler.Verify(request, response); err != nil {
		return nil, err
	}
	pdu, err := s.handler.Decode(response)
	if err != nil {
		return nil, err
	}
	if pdu.FunctionCode == frame[1]|0x80 {
		if len(pdu.Data) != 1 || pdu.Data[0] == 0 {
			return nil, fmt.Errorf("malformed Modbus exception")
		}
		return nil, fmt.Errorf("Modbus exception: function=%d code=%d", frame[1], pdu.Data[0])
	}
	if pdu.FunctionCode != frame[1] {
		return nil, fmt.Errorf("Modbus response function mismatch")
	}
	if frame[1] <= 4 {
		quantity := int(binary.BigEndian.Uint16(frame[4:6]))
		expected := quantity * 2
		if frame[1] <= 2 {
			expected = (quantity + 7) / 8
		}
		if len(pdu.Data) != expected+1 || int(pdu.Data[0]) != expected {
			return nil, fmt.Errorf("Modbus response byte count/length mismatch")
		}
	} else if len(pdu.Data) != 4 || !bytes.Equal(pdu.Data, frame[2:6]) {
		return nil, fmt.Errorf("Modbus write acknowledgement mismatch; physical outcome unknown")
	}
	return append([]byte{frame[0], pdu.FunctionCode}, pdu.Data...), nil
}

func validateRequest(frame []byte) error {
	if len(frame) < 6 || frame[0] < 1 || frame[0] > 247 {
		return fmt.Errorf("invalid Modbus request length/unit")
	}
	address := int(binary.BigEndian.Uint16(frame[2:4]))
	quantity := int(binary.BigEndian.Uint16(frame[4:6]))
	maximum := 0
	switch frame[1] {
	case 1, 2:
		maximum = 2000
	case 3, 4:
		maximum = 125
	case 5, 6:
		if len(frame) != 6 {
			return fmt.Errorf("invalid single-write request length")
		}
		if frame[1] == 5 && quantity != 0 && quantity != 0xff00 {
			return fmt.Errorf("invalid coil value")
		}
		return nil
	case 15:
		maximum = 1968
	case 16:
		maximum = 123
	default:
		return fmt.Errorf("unsupported function code: %d", frame[1])
	}
	if quantity < 1 || quantity > maximum || address+quantity > 65536 {
		return fmt.Errorf("invalid Modbus address/quantity")
	}
	if frame[1] <= 4 {
		if len(frame) != 6 {
			return fmt.Errorf("invalid read request length")
		}
		return nil
	}
	expected := quantity * 2
	if frame[1] == 15 {
		expected = (quantity + 7) / 8
	}
	if len(frame) != 7+expected || int(frame[6]) != expected {
		return fmt.Errorf("invalid multi-write byte count/length")
	}
	return nil
}
