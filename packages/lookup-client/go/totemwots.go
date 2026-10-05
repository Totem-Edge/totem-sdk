package lookupclient

import (
	"encoding/hex"

	"github.com/totem-sdk/core-ffi"
)

// CoreWotsSigner is the RFC-033 byte-exact lookup signer. It mirrors the
// TypeScript `LookupIdentity`: a hierarchical TreeKey whose root public key is
// the identity, signing the RFC-032 auth digest and returning the serialized
// (Java-Streamable) TreeSignature — exactly what a TS/Java node verifies.
//
// The nonce is the TreeKey use counter (strictly increasing). Persist
// `Uses()`/`SetUses()` across restarts to avoid reusing a one-time leaf.
type CoreWotsSigner struct {
	tree *totemcrypto.TreeKey
	pub  string // hex root public key
}

// NewCoreWotsSigner builds a signer from a 32-byte seed (64 keys/level, 3 levels,
// matching the TS per-address TreeKey).
func NewCoreWotsSigner(seed []byte) (*CoreWotsSigner, error) {
	tree, err := totemcrypto.NewTreeKey(seed, 64, 3)
	if err != nil {
		return nil, err
	}
	pk, err := tree.PublicKey()
	if err != nil {
		tree.Free()
		return nil, err
	}
	return &CoreWotsSigner{tree: tree, pub: hex.EncodeToString(pk)}, nil
}

// RootPublicKey returns the hex TreeKey root public key.
func (s *CoreWotsSigner) RootPublicKey() string { return s.pub }

// Nonce returns the next TreeKey use index.
func (s *CoreWotsSigner) Nonce() int64 { return int64(s.tree.Uses()) }

// Sign signs the digest and returns the serialized TreeSignature bytes.
func (s *CoreWotsSigner) Sign(digest []byte) ([]byte, error) {
	sigJSON, err := s.tree.Sign(digest)
	if err != nil {
		return nil, err
	}
	return totemcrypto.SerializeTreeSignature(sigJSON)
}

// SetUses restores the use counter (forward-only is the caller's responsibility).
func (s *CoreWotsSigner) SetUses(uses uint32) { s.tree.SetUses(uses) }

// Uses returns the current use counter.
func (s *CoreWotsSigner) Uses() uint32 { return s.tree.Uses() }

// Free releases the native TreeKey handle.
func (s *CoreWotsSigner) Free() { s.tree.Free() }

// CoreWotsVerifier is the RFC-033 byte-exact lookup verifier (hierarchical).
type CoreWotsVerifier struct{}

// Verify verifies a hex serialized-TreeSignature over a 32-byte digest against
// a hex TreeKey root public key.
func (CoreWotsVerifier) Verify(rootPublicKeyHex string, digest []byte, signatureHex string) bool {
	pk, err := hex.DecodeString(rootPublicKeyHex)
	if err != nil {
		return false
	}
	sigBytes, err := hex.DecodeString(signatureHex)
	if err != nil {
		return false
	}
	sigJSON, err := totemcrypto.DeserializeTreeSignature(sigBytes)
	if err != nil {
		return false
	}
	return totemcrypto.VerifyTreeSignature(pk, digest, sigJSON)
}
