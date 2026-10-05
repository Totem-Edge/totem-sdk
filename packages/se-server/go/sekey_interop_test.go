// RFC-033 — Go flat-WOTS interop: the SE signature must verify in TypeScript.
// Run: go test -run TestSeSignInterop ./...
package seserver

import (
	"encoding/hex"
	"encoding/json"
	"os"
	"testing"

	"github.com/totem-sdk/core-ffi"
)

func TestSeSignInterop(t *testing.T) {
	seed := make([]byte, 32)
	for i := range seed {
		seed[i] = 0x44
	}
	message := make([]byte, 32)
	for i := range message {
		message[i] = byte(i * 3)
	}
	sig, err := seSign(seed, message)
	if err != nil {
		t.Fatalf("seSign: %v", err)
	}
	if len(sig) != 1088 {
		t.Fatalf("expected 1088-byte signature, got %d", len(sig))
	}
	pkDigest, err := totemcrypto.DerivePKDigest(seed, 0)
	if err != nil {
		t.Fatalf("pk digest: %v", err)
	}
	if !wotsVerifyDigest(sig, message, pkDigest) {
		t.Fatal("self-verify failed")
	}
	if getPublicKeyHex(seed) != hex.EncodeToString(pkDigest) {
		t.Fatal("getPublicKeyHex does not match DerivedPKDigest")
	}

	// Emit for the TS side to verify.
	out := map[string]string{
		"seedHex":    hex.EncodeToString(seed),
		"messageHex": hex.EncodeToString(message),
		"pkDigest":   hex.EncodeToString(pkDigest),
		"signature":  hex.EncodeToString(sig),
	}
	raw, _ := json.Marshal(out)
	_ = os.WriteFile("se-interop-vector.json", raw, 0o644)
}
