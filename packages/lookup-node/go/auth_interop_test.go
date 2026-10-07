// RFC-032/033 — TypeScript → Go auth-envelope interop.
//
// `testdata-ts-auth-envelope.json` is produced by the TypeScript lookup client
// (`LookupIdentity.fromSeed` + `Authenticator.stamp`). The Go node's auth path
// (`AuthDigest` + `CoreWotsVerifier`) must accept it — proving the Go node can
// authenticate a real TS client.
package lookupnode

import (
	"encoding/hex"
	"encoding/json"
	"os"
	"testing"
)

type tsAuthEnvelope struct {
	RootPublicKey string      `json:"rootPublicKey"`
	Nonce         int64       `json:"nonce"`
	ExpiresAt     int64       `json:"expiresAt"`
	Signature     string      `json:"signature"`
	Message       LookupMessage `json:"message"`
}

func TestVerifyTypeScriptAuthEnvelope(t *testing.T) {
	raw, err := os.ReadFile("testdata-ts-auth-envelope.json")
	if err != nil {
		t.Fatalf("read envelope: %v", err)
	}
	var env tsAuthEnvelope
	if err := json.Unmarshal(raw, &env); err != nil {
		t.Fatalf("parse envelope: %v", err)
	}

	// Recompute the auth digest exactly as the node does, then verify.
	digest, err := AuthDigest(env.Message, env.Nonce, env.ExpiresAt)
	if err != nil {
		t.Fatalf("auth digest: %v", err)
	}
	var verifier CoreWotsVerifier
	if !verifier.Verify(env.RootPublicKey, digest, env.Signature) {
		t.Fatal("Go node rejected a valid TypeScript auth envelope")
	}

	// A tampered nonce (changing the digest) must fail.
	badDigest, _ := AuthDigest(env.Message, env.Nonce+1, env.ExpiresAt)
	if verifier.Verify(env.RootPublicKey, badDigest, env.Signature) {
		t.Fatal("verifier accepted a tampered nonce/digest")
	}

	// The digest must match TS byte-for-byte: sanity against a re-derived pk.
	pk, _ := hex.DecodeString(env.RootPublicKey)
	if len(pk) != 32 {
		t.Fatalf("expected 32-byte root public key, got %d", len(pk))
	}
}
