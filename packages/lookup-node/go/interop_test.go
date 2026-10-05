// RFC-033 — bidirectional TypeScript ⇄ Go interop.
//
//  - `TestVerifyTypeScriptTreeSignature`: the Go cgo binding must verify a
//    signature produced by the TypeScript/Rust engine (checked-in vector).
//  - `TestEmitGoTreeKeyVector`: emits a Go-produced signature so the TypeScript
//    side can verify it (see `../src/__tests__/go-interop.test.ts`). Runs only
//    when `EMIT_GO_INTEROP=1` so it does not slow the normal suite or dirty the
//    tree.
package lookupnode

import (
	"encoding/hex"
	"encoding/json"
	"os"
	"testing"

	"github.com/totem-sdk/core-ffi"
)

type tsTreeKeyVector struct {
	SeedHex    string `json:"seedHex"`
	DigestHex  string `json:"digestHex"`
	RootPubHex string `json:"rootPubHex"`
	SigHex     string `json:"sigHex"`
}

func TestVerifyTypeScriptTreeSignature(t *testing.T) {
	raw, err := os.ReadFile("testdata-ts-treekey-vector.json")
	if err != nil {
		t.Fatalf("read vector: %v", err)
	}
	var v tsTreeKeyVector
	if err := json.Unmarshal(raw, &v); err != nil {
		t.Fatalf("parse vector: %v", err)
	}
	rootPub, _ := hex.DecodeString(v.RootPubHex)
	digest, _ := hex.DecodeString(v.DigestHex)
	sigBytes, _ := hex.DecodeString(v.SigHex)

	sigJSON, err := totemcrypto.DeserializeTreeSignature(sigBytes)
	if err != nil {
		t.Fatalf("deserialize TS signature: %v", err)
	}
	if !totemcrypto.VerifyTreeSignature(rootPub, digest, sigJSON) {
		t.Fatal("Go rejected a valid TypeScript TreeSignature")
	}
	var verifier CoreWotsVerifier
	if !verifier.Verify(v.RootPubHex, digest, v.SigHex) {
		t.Fatal("CoreWotsVerifier rejected a valid TypeScript signature")
	}
	bad := append([]byte{}, digest...)
	bad[0] ^= 0xff
	if verifier.Verify(v.RootPubHex, bad, v.SigHex) {
		t.Fatal("verifier accepted a tampered digest")
	}
}

// TestEmitGoTreeKeyVector writes a Go-produced signature for the TS side to
// verify. Gated on EMIT_GO_INTEROP=1 (slow: full 64x64 TreeKey derivation).
func TestEmitGoTreeKeyVector(t *testing.T) {
	if os.Getenv("EMIT_GO_INTEROP") != "1" {
		t.Skip("set EMIT_GO_INTEROP=1 to emit the Go interop vector")
	}
	seed := make([]byte, 32)
	for i := range seed {
		seed[i] = 0x55
	}
	signer, err := NewCoreWotsSigner(seed)
	if err != nil {
		t.Fatalf("signer: %v", err)
	}
	defer signer.Free()

	digest := make([]byte, 32)
	for i := range digest {
		digest[i] = byte(i + 1)
	}
	sig, err := signer.Sign(digest)
	if err != nil {
		t.Fatalf("sign: %v", err)
	}
	out := tsTreeKeyVector{
		SeedHex:    hex.EncodeToString(seed),
		DigestHex:  hex.EncodeToString(digest),
		RootPubHex: signer.RootPublicKey(),
		SigHex:     hex.EncodeToString(sig),
	}
	raw, _ := json.MarshalIndent(out, "", "  ")
	if err := os.WriteFile("../src/__tests__/testdata-go-treekey-vector.json", raw, 0o644); err != nil {
		t.Fatalf("write vector: %v", err)
	}
	t.Logf("emitted Go TreeSignature vector (%d bytes)", len(sig))
}
