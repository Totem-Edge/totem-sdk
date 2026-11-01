package main

import (
	"encoding/base64"
	"strings"
	"testing"
)

func TestRawCodecRoundTrip(t *testing.T) {
	codec := rawCodec{}
	payload := []byte{0x0a, 0x01, 0x02}
	encoded, err := codec.Marshal(&payload)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	var decoded []byte
	if err := codec.Unmarshal(encoded, &decoded); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if string(decoded) != string(payload) {
		t.Fatalf("round trip mismatch: %x != %x", decoded, payload)
	}
	if codec.Name() != "proto" {
		t.Fatalf("unexpected codec name %q", codec.Name())
	}
	if _, err := codec.Marshal("not bytes"); err == nil {
		t.Fatal("expected unsupported marshal type to fail")
	}
	if err := codec.Unmarshal([]byte{1}, "not bytes"); err == nil {
		t.Fatal("expected unsupported unmarshal destination to fail")
	}
}

func TestValidPath(t *testing.T) {
	for _, path := range []string{"/pkg.Service/Method", "/a/B"} {
		if err := validPath(path); err != nil {
			t.Fatalf("expected %q to be valid: %v", path, err)
		}
	}
	for _, path := range []string{"", "pkg.Service/Method", "/onlyservice", "/a/b/c", "/a/"} {
		if err := validPath(path); err == nil {
			t.Fatalf("expected %q to be rejected", path)
		}
	}
}

func TestDecodePayload(t *testing.T) {
	payload := []byte{1, 2, 3}
	decoded, err := decodePayload(base64.StdEncoding.EncodeToString(payload))
	if err != nil || string(decoded) != string(payload) {
		t.Fatalf("unexpected decode: %v %x", err, decoded)
	}
	if _, err := decodePayload("!!!"); err == nil || !strings.Contains(err.Error(), "invalid base64") {
		t.Fatalf("expected invalid base64 error, got %v", err)
	}
	oversized := make([]byte, maxPayloadBytes+1)
	if _, err := decodePayload(base64.StdEncoding.EncodeToString(oversized)); err == nil || !strings.Contains(err.Error(), "exceeds") {
		t.Fatalf("expected oversized payload error, got %v", err)
	}
}

func TestBuildTLSCredentialsRejectsInvalidMaterial(t *testing.T) {
	if _, err := buildTLSCredentials(&TLSRequest{CACert: "not a certificate"}); err == nil {
		t.Fatal("expected invalid CA to fail")
	}
	if _, err := buildTLSCredentials(&TLSRequest{Cert: "not a certificate", Key: "not a key"}); err == nil {
		t.Fatal("expected invalid client certificate to fail")
	}
	if _, err := buildTLSCredentials(&TLSRequest{ServerName: "localhost"}); err != nil {
		t.Fatalf("system-root TLS profile should be valid: %v", err)
	}
}
