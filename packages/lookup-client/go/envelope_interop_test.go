// RFC-032/033 — Go → TypeScript auth-envelope interop.
//
// Emits a Go-signed auth envelope (via CoreWotsSigner + AuthDigest) so the
// TypeScript lookup client can verify it with `verifyMessageAuth`, proving the
// Go client can authenticate to a TS node.
// Run: EMIT_GO_ENVELOPE=1 go test -run TestEmitGoAuthEnvelope
package lookupclient

import (
	"encoding/hex"
	"encoding/json"
	"os"
	"testing"
)

func TestEmitGoAuthEnvelope(t *testing.T) {
	if os.Getenv("EMIT_GO_ENVELOPE") != "1" {
		t.Skip("set EMIT_GO_ENVELOPE=1 to emit the Go auth envelope")
	}
	seed := make([]byte, 32)
	for i := range seed {
		seed[i] = 0x77
	}
	signer, err := NewCoreWotsSigner(seed)
	if err != nil {
		t.Fatalf("signer: %v", err)
	}
	defer signer.Free()

	msg := LookupMessage{
		Type:    "GET_COINS",
		Version: ProtocolVersion,
		ID:      "gc-go-1",
		Payload: json.RawMessage(`{"address":"Mx1"}`),
	}
	const nonce int64 = 0
	const expiresAt int64 = 4102444800000 // 2100-01-01, so TS freshness passes
	digest, err := AuthDigest(msg, nonce, expiresAt)
	if err != nil {
		t.Fatalf("digest: %v", err)
	}
	sig, err := signer.Sign(digest)
	if err != nil {
		t.Fatalf("sign: %v", err)
	}

	out := map[string]interface{}{
		"rootPublicKey": signer.RootPublicKey(),
		"nonce":         nonce,
		"expiresAt":     expiresAt,
		"signature":     hex.EncodeToString(sig),
		"message": map[string]interface{}{
			"type":    msg.Type,
			"version": msg.Version,
			"id":      msg.ID,
			"payload": map[string]string{"address": "Mx1"},
		},
	}
	raw, _ := json.MarshalIndent(out, "", "  ")
	if err := os.WriteFile("../src/__tests__/testdata-go-auth-envelope.json", raw, 0o644); err != nil {
		t.Fatal(err)
	}
	t.Log("emitted Go auth envelope")
}
