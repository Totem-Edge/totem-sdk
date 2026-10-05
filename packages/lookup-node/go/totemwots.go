package lookupnode

import (
	"encoding/hex"

	"github.com/totem-sdk/core-ffi"
)

// CoreWotsVerifier is the RFC-033 byte-exact lookup verifier (hierarchical
// TreeKey), backed by the core Rust crypto via cgo. It verifies the serialized
// (Java-Streamable) TreeSignature the TS client produces.
//
// Wire it as `LookupNodeConfig.Verifier`:
//
//	cfg.Verifier = lookupnode.CoreWotsVerifier{}
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

// CoreWotsSigner is the RFC-033 byte-exact lookup signer (hierarchical TreeKey),
// symmetric with the lookup-client signer. It is provided for tests and for a
// Go-native client.
type CoreWotsSigner struct {
	tree *totemcrypto.TreeKey
	pub  string
}

// NewCoreWotsSigner builds a signer from a 32-byte seed.
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

// Free releases the native handle.
func (s *CoreWotsSigner) Free() { s.tree.Free() }
