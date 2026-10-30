package main

import (
	"bytes"
	"testing"

	"github.com/goburrow/modbus"
)

// Independent Modbus CRC-16 implementation (poly 0xA001, init 0xFFFF).
func crc16(data []byte) uint16 {
	crc := uint16(0xffff)
	for _, b := range data {
		crc ^= uint16(b)
		for i := 0; i < 8; i++ {
			if crc&1 != 0 {
				crc = (crc >> 1) ^ 0xa001
			} else {
				crc >>= 1
			}
		}
	}
	return crc
}

func withCRC(frame []byte) []byte {
	crc := crc16(frame)
	return append(append([]byte{}, frame...), byte(crc), byte(crc>>8))
}

func TestRTUFramingAndCRC(t *testing.T) {
	handler := modbus.NewRTUClientHandler("unused")
	handler.SlaveId = 1
	request, err := handler.Encode(&modbus.ProtocolDataUnit{
		FunctionCode: 3,
		Data:         []byte{0, 0, 0, 2},
	})
	if err != nil {
		t.Fatal(err)
	}
	want := []byte{0x01, 0x03, 0x00, 0x00, 0x00, 0x02, 0xc4, 0x0b}
	if !bytes.Equal(request, want) {
		t.Fatalf("RTU request %x != known vector %x", request, want)
	}
	if !bytes.Equal(request[6:], []byte{byte(crc16(request[:6])), byte(crc16(request[:6]) >> 8)}) {
		t.Fatalf("request CRC does not match independent implementation: %x", request)
	}

	response := withCRC([]byte{1, 3, 4, 0, 1, 0, 2})
	if err := handler.Verify(request, response); err != nil {
		t.Fatalf("valid response rejected: %v", err)
	}
	pdu, err := handler.Decode(response)
	if err != nil {
		t.Fatal(err)
	}
	if pdu.FunctionCode != 3 || !bytes.Equal(pdu.Data, []byte{4, 0, 1, 0, 2}) {
		t.Fatalf("decoded PDU mismatch: function=%d data=%x", pdu.FunctionCode, pdu.Data)
	}

	exception := withCRC([]byte{1, 0x83, 2})
	pdu, err = handler.Decode(exception)
	if err != nil {
		t.Fatalf("valid exception CRCs rejected: %v", err)
	}
	if pdu.FunctionCode != 0x83 || !bytes.Equal(pdu.Data, []byte{2}) {
		t.Fatalf("exception PDU mismatch: function=%d data=%x", pdu.FunctionCode, pdu.Data)
	}
}

func TestRTURejectsCorruptionAndWrongUnit(t *testing.T) {
	handler := modbus.NewRTUClientHandler("unused")
	handler.SlaveId = 7
	request, err := handler.Encode(&modbus.ProtocolDataUnit{FunctionCode: 4, Data: []byte{0, 10, 0, 1}})
	if err != nil {
		t.Fatal(err)
	}
	valid := withCRC([]byte{7, 4, 2, 0xab, 0xcd})
	if err := handler.Verify(request, valid); err != nil {
		t.Fatal(err)
	}
	if _, err := handler.Decode(valid); err != nil {
		t.Fatal(err)
	}

	wrongUnit := withCRC([]byte{8, 4, 2, 0xab, 0xcd})
	if err := handler.Verify(request, wrongUnit); err == nil {
		t.Fatal("accepted wrong slave id")
	}
	if _, err := handler.Decode(append(wrongUnit[:len(wrongUnit)-1], wrongUnit[len(wrongUnit)-1]^0xff)); err == nil {
		t.Fatal("accepted corrupted CRC")
	}
	if _, err := handler.Decode(valid[:len(valid)-1]); err == nil {
		t.Fatal("accepted truncated CRC frame")
	}
}

func TestRTUEncodeBounds(t *testing.T) {
	handler := modbus.NewRTUClientHandler("unused")
	if _, err := handler.Encode(&modbus.ProtocolDataUnit{FunctionCode: 16, Data: make([]byte, 252)}); err != nil {
		t.Fatalf("max RTU PDU rejected: %v", err)
	}
	if _, err := handler.Encode(&modbus.ProtocolDataUnit{FunctionCode: 16, Data: make([]byte, 253)}); err == nil {
		t.Fatal("oversized RTU PDU accepted")
	}
}
