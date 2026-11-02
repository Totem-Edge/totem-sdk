package main

import (
	"errors"
	"fmt"
	"net"
)

const (
	protocolVersion = 1
	// UDP payload limit for IPv4; CoAP messages are far smaller in practice.
	maxDatagram = 65507
	minCoAP     = 4
)

// validateTarget rejects malformed destination/payload pairs before the bridge
// writes to the UDP socket.
func validateTarget(host string, port int, data []byte) error {
	if host == "" {
		return errors.New("host required")
	}
	if net.ParseIP(host) == nil {
		return fmt.Errorf("invalid host %q", host)
	}
	if port < 1 || port > 65535 {
		return fmt.Errorf("invalid port %d", port)
	}
	if len(data) < minCoAP {
		return fmt.Errorf("CoAP message must be at least %d bytes, got %d", minCoAP, len(data))
	}
	if len(data) > maxDatagram {
		return fmt.Errorf("CoAP message exceeds %d bytes", maxDatagram)
	}
	return nil
}
