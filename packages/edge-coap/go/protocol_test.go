package main

import (
	"strings"
	"testing"
)

func TestValidateTarget(t *testing.T) {
	message := []byte{0x44, 0x01, 0x00, 0x01}
	tests := []struct {
		name    string
		host    string
		port    int
		data    []byte
		wantErr string
	}{
		{name: "loopback", host: "127.0.0.1", port: 5683, data: message},
		{name: "ipv6", host: "::1", port: 5683, data: message},
		{name: "missing host", host: "", port: 5683, data: message, wantErr: "host required"},
		{name: "hostname is not an address", host: "example.invalid", port: 5683, data: message, wantErr: "invalid host"},
		{name: "port zero", host: "127.0.0.1", port: 0, data: message, wantErr: "invalid port"},
		{name: "port too large", host: "127.0.0.1", port: 65536, data: message, wantErr: "invalid port"},
		{name: "short message", host: "127.0.0.1", port: 5683, data: message[:3], wantErr: "at least 4 bytes"},
		{name: "oversized message", host: "127.0.0.1", port: 5683, data: make([]byte, maxDatagram+1), wantErr: "exceeds"},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			err := validateTarget(test.host, test.port, test.data)
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
