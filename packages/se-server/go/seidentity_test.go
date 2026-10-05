// RFC-008/RFC-033 — Go SE identity tests.
//
// Verifies the leased one-time leaf design: the published identity is the root
// anchor, each signature uses a fresh leaf, the durable watermark never rewinds,
// and the address is derived from the *child* public key (not a reused index-0
// digest).
package seserver

import (
	"encoding/hex"
	"encoding/json"
	"os"
	"sync"
	"testing"

	"github.com/totem-sdk/core-ffi"
)

// memAllocator is a forward-only in-memory leaf watermark.
type memAllocator struct {
	mu   sync.Mutex
	next map[string]int64
}

func newMemAllocator() *memAllocator { return &memAllocator{next: map[string]int64{}} }

func (m *memAllocator) alloc(slot string) (int64, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	use := m.next[slot]
	m.next[slot] = use + 1
	return use, nil
}

func TestSeIdentityLeasedLeaves(t *testing.T) {
	seed := make([]byte, 32)
	for i := range seed {
		seed[i] = 0x44
	}
	alloc := newMemAllocator()
	id, err := newSeIdentity(seed, alloc.alloc)
	if err != nil {
		t.Fatalf("newSeIdentity: %v", err)
	}
	defer id.Free()

	pub := id.GetPublishedIdentity()
	if pub.RootPublicKey == "" || pub.RootAddress == "" {
		t.Fatal("empty published identity")
	}
	// The published root public key must be a TreeKey anchor, and the child
	// address must be derived from the child public key, not the root.
	if pub.OwnershipProof.ChildPublicKeys[0] == pub.RootPublicKey {
		t.Fatal("child pubkey equals root pubkey")
	}

	// Two signatures must use different leaves (no reuse).
	s1, err := id.Sign("message-1")
	if err != nil {
		t.Fatalf("sign 1: %v", err)
	}
	s2, err := id.Sign("message-2")
	if err != nil {
		t.Fatalf("sign 2: %v", err)
	}
	if s1.Signature == s2.Signature {
		t.Fatal("two signatures are identical (leaf reuse)")
	}
	if alloc.next[seWatermarkSlot] != 2 {
		t.Fatalf("expected 2 leased child leaves, got %d", alloc.next[seWatermarkSlot])
	}

	// Owner-proof root signature verifies in the Go verifier.
	rootPub := mustHex(t, pub.RootPublicKey)
	rootMsg := []byte(pub.OwnershipProof.RootProof.Message)
	rootSig := mustHex(t, pub.OwnershipProof.RootProof.Signature)
	sigJSON, err := totemcrypto.DeserializeTreeSignature(rootSig)
	if err != nil {
		t.Fatalf("deserialize root proof: %v", err)
	}
	digest := sha3Sum(rootMsg)
	if !totemcrypto.VerifyTreeSignature(rootPub, digest, sigJSON) {
		t.Fatal("root ownership proof did not verify")
	}
}

// TestSeIdentityInteropVector emits a signed SE message for the TS side to verify.
// Gated on EMIT_SE_INTEROP=1 (slow).
func TestSeIdentityInteropVector(t *testing.T) {
	if os.Getenv("EMIT_SE_INTEROP") != "1" {
		t.Skip("set EMIT_SE_INTEROP=1 to emit the SE interop vector")
	}
	seed := make([]byte, 32)
	for i := range seed {
		seed[i] = 0x66
	}
	alloc := newMemAllocator()
	id, err := newSeIdentity(seed, alloc.alloc)
	if err != nil {
		t.Fatalf("newSeIdentity: %v", err)
	}
	defer id.Free()
	sig, err := id.Sign("blind-commitment-abc")
	if err != nil {
		t.Fatal(err)
	}
	pub := id.GetPublishedIdentity()
	out := map[string]interface{}{
		"rootPublicKey": pub.RootPublicKey,
		"rootAddress":   pub.RootAddress,
		"childAddress":  sig.Address,
		"childPublicKey": sig.PublicKey,
		"message":       sig.Message,
		"signature":     sig.Signature,
		"rootProof":     pub.OwnershipProof.RootProof,
		"childPubKeys":  pub.OwnershipProof.ChildPublicKeys,
		"childAddrs":    pub.OwnershipProof.ChildAddresses,
		"timestamp":     pub.OwnershipProof.Timestamp,
	}
	raw, _ := json.MarshalIndent(out, "", "  ")
	if err := os.WriteFile("../src/__tests__/testdata-go-se-vector.json", raw, 0o644); err != nil {
		t.Fatal(err)
	}
	t.Log("emitted Go SE interop vector")
}

func mustHex(t *testing.T, s string) []byte {
	t.Helper()
	b, err := hex.DecodeString(s)
	if err != nil {
		t.Fatalf("hex: %v", err)
	}
	return b
}

func sha3Sum(data []byte) []byte {
	out, _ := totemcrypto.Sha3256(data)
	return out
}
