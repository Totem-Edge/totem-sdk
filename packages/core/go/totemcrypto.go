// Package totemcrypto (RFC-033) is a byte-exact WOTS/TreeKey binding over the
// Totem core Rust implementation, linked via cgo. It exists so the Go mirrors
// (lookup-*, se-server) can sign and verify with the *same* crypto that already
// passes Java parity in the TypeScript/WASM engine — no hand-ported divergence.
//
// Build the native library first:
//
//	scripts/build-core-ffi.sh release
//
// The static archive is staged under native/core-ffi/{lib,include}.
package totemcrypto

/*
#cgo CFLAGS: -I${SRCDIR}/../../../native/core-ffi/include
#cgo LDFLAGS: -L${SRCDIR}/../../../native/core-ffi/lib -ltotemsdk_core_ffi
#cgo darwin LDFLAGS: -framework Security -framework CoreFoundation
#cgo linux LDFLAGS: -lpthread -ldl -lm

#include <stdlib.h>
#include "totem_ffi.h"
*/
import "C"

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"runtime"
	"sort"
	"strconv"
	"strings"
	"unsafe"
)

// CanonicalJSON produces deterministic JSON matching @totemsdk/lookup-protocol's
// `canonicalJson` byte-for-byte: recursively sorted object keys, no HTML
// escaping, arrays in order. It is the digest preimage for RFC-032 auth, so a
// mismatch would make Go-signed envelopes fail to verify in TypeScript.
func CanonicalJSON(v interface{}) (string, error) {
	var b strings.Builder
	if err := writeCanonical(&b, v); err != nil {
		return "", err
	}
	return b.String(), nil
}

func jsonString(s string) string {
	var buf bytes.Buffer
	enc := json.NewEncoder(&buf)
	enc.SetEscapeHTML(false)
	_ = enc.Encode(s)
	return strings.TrimRight(buf.String(), "\n")
}

func writeCanonical(b *strings.Builder, v interface{}) error {
	switch x := v.(type) {
	case nil:
		b.WriteString("null")
	case bool:
		if x {
			b.WriteString("true")
		} else {
			b.WriteString("false")
		}
	case string:
		b.WriteString(jsonString(x))
	case json.Number:
		b.WriteString(x.String())
	case float64:
		b.WriteString(strconv.FormatFloat(x, 'g', -1, 64))
	case int:
		b.WriteString(strconv.Itoa(x))
	case int64:
		b.WriteString(strconv.FormatInt(x, 10))
	case []interface{}:
		b.WriteByte('[')
		for i, e := range x {
			if i > 0 {
				b.WriteByte(',')
			}
			if err := writeCanonical(b, e); err != nil {
				return err
			}
		}
		b.WriteByte(']')
	case map[string]interface{}:
		keys := make([]string, 0, len(x))
		for k := range x {
			keys = append(keys, k)
		}
		sort.Strings(keys)
		b.WriteByte('{')
		for i, k := range keys {
			if i > 0 {
				b.WriteByte(',')
			}
			b.WriteString(jsonString(k))
			b.WriteByte(':')
			if err := writeCanonical(b, x[k]); err != nil {
				return err
			}
		}
		b.WriteByte('}')
	default:
		return fmt.Errorf("canonicalJSON: unsupported type %T", v)
	}
	return nil
}

// ErrUnavailable is returned when the native library produced no result
// (e.g. an internal panic caught at the FFI boundary). Callers fail closed.
var ErrUnavailable = errors.New("totemcrypto: native core unavailable")

// errMsg is the error returned by treekey construction.
func bytesPtr(b []byte) *C.uint8_t {
	if len(b) == 0 {
		return nil
	}
	return (*C.uint8_t)(unsafe.Pointer(&b[0]))
}

func takeBytes(ptr *C.uint8_t, n C.size_t) []byte {
	if ptr == nil || n == 0 {
		return nil
	}
	out := C.GoBytes(unsafe.Pointer(ptr), C.int(n))
	C.totem_free(ptr, n)
	return out
}

// Sha3256 returns SHA3-256(data).
func Sha3256(data []byte) ([]byte, error) {
	var outLen C.size_t
	ptr := C.totem_sha3_256(bytesPtr(data), C.size_t(len(data)), &outLen)
	if ptr == nil {
		return nil, ErrUnavailable
	}
	runtime.KeepAlive(data)
	return takeBytes(ptr, outLen), nil
}

// Sign returns wotsSign(seed, index, message): the 1088-byte flat WOTS signature.
func Sign(seed []byte, index uint32, message []byte) ([]byte, error) {
	if len(seed) != 32 {
		return nil, fmt.Errorf("totemcrypto: seed must be 32 bytes, got %d", len(seed))
	}
	var outLen C.size_t
	ptr := C.totem_wots_sign(bytesPtr(seed), C.size_t(len(seed)), C.uint32_t(index),
		bytesPtr(message), C.size_t(len(message)), &outLen)
	if ptr == nil {
		return nil, ErrUnavailable
	}
	runtime.KeepAlive(seed)
	runtime.KeepAlive(message)
	return takeBytes(ptr, outLen), nil
}

// VerifyDigest verifies a signature against a 32-byte public-key digest.
func VerifyDigest(sig, message, pkDigest []byte) bool {
	return C.totem_wots_verify_digest(bytesPtr(sig), C.size_t(len(sig)),
		bytesPtr(message), C.size_t(len(message)),
		bytesPtr(pkDigest), C.size_t(len(pkDigest))) == 1
}

// Verify verifies a signature against the full 1088-byte public key.
func Verify(sig, message, pkFull []byte) bool {
	return C.totem_wots_verify(bytesPtr(sig), C.size_t(len(sig)),
		bytesPtr(message), C.size_t(len(message)),
		bytesPtr(pkFull), C.size_t(len(pkFull))) == 1
}

// DerivePKDigest returns the 32-byte WOTS public-key digest for (seed, index).
func DerivePKDigest(seed []byte, index uint32) ([]byte, error) {
	var outLen C.size_t
	ptr := C.totem_derive_pk_digest(bytesPtr(seed), C.size_t(len(seed)), C.uint32_t(index), &outLen)
	if ptr == nil {
		return nil, ErrUnavailable
	}
	runtime.KeepAlive(seed)
	return takeBytes(ptr, outLen), nil
}

// DeriveFullPublicKey returns the full 1088-byte WOTS public key.
func DeriveFullPublicKey(seed []byte, index uint32) ([]byte, error) {
	var outLen C.size_t
	ptr := C.totem_derive_full_public_key(bytesPtr(seed), C.size_t(len(seed)), C.uint32_t(index), &outLen)
	if ptr == nil {
		return nil, ErrUnavailable
	}
	runtime.KeepAlive(seed)
	return takeBytes(ptr, outLen), nil
}

// AddressFromKeypair returns the Minima Mx... address for (seed, index).
func AddressFromKeypair(seed []byte, index uint32) (string, error) {
	var outLen C.size_t
	ptr := C.totem_wots_address_from_keypair(bytesPtr(seed), C.size_t(len(seed)), C.uint32_t(index), &outLen)
	if ptr == nil {
		return "", ErrUnavailable
	}
	runtime.KeepAlive(seed)
	return string(takeBytes(ptr, outLen)), nil
}

// TimingSafeEqual compares two byte slices in constant time.
func TimingSafeEqual(a, b []byte) bool {
	return C.totem_timing_safe_equal(bytesPtr(a), C.size_t(len(a)), bytesPtr(b), C.size_t(len(b))) == 1
}

// TreeKey is a stateful hierarchical signing key (mirrors the TS TreeKey).
type TreeKey struct {
	handle C.uint32_t
}

// NewTreeKey builds a TreeKey from a 32-byte seed. keysPerLevel/levels default
// to 64/3 when zero.
func NewTreeKey(seed []byte, keysPerLevel, levels uint32) (*TreeKey, error) {
	if len(seed) != 32 {
		return nil, fmt.Errorf("totemcrypto: seed must be 32 bytes, got %d", len(seed))
	}
	var errOut *C.char
	handle := C.totem_treekey_new(bytesPtr(seed), C.size_t(len(seed)),
		C.uint32_t(keysPerLevel), C.uint32_t(levels), &errOut)
	runtime.KeepAlive(seed)
	if handle == 0 {
		return nil, fmt.Errorf("totemcrypto: TreeKey.new failed: %s", takeString(errOut))
	}
	return &TreeKey{handle: handle}, nil
}

// NewUnifiedRootTreeKey builds the root identity TreeKey (TS
// createUnifiedRootTreeKey): 64 keys/level, 3 levels, derived with the
// "ROOT_IDENTITY" domain separation the TypeScript SE uses.
func NewUnifiedRootTreeKey(baseSeed []byte) (*TreeKey, error) {
	var errOut *C.char
	handle := C.totem_create_unified_root_tree_key(bytesPtr(baseSeed), C.size_t(len(baseSeed)), &errOut)
	runtime.KeepAlive(baseSeed)
	if handle == 0 {
		return nil, fmt.Errorf("totemcrypto: unified root TreeKey failed: %s", takeString(errOut))
	}
	return &TreeKey{handle: handle}, nil
}

// NewUnifiedChildTreeKey builds a child (spend address) TreeKey (TS
// createUnifiedChildTreeKey) for address `index`.
func NewUnifiedChildTreeKey(baseSeed []byte, index uint32) (*TreeKey, error) {
	var errOut *C.char
	handle := C.totem_create_unified_child_tree_key(bytesPtr(baseSeed), C.size_t(len(baseSeed)), C.uint32_t(index), &errOut)
	runtime.KeepAlive(baseSeed)
	if handle == 0 {
		return nil, fmt.Errorf("totemcrypto: unified child TreeKey failed: %s", takeString(errOut))
	}
	return &TreeKey{handle: handle}, nil
}

// Sign signs data, returning the TreeSignature as JSON bytes.
func (t *TreeKey) Sign(data []byte) ([]byte, error) {
	var outLen C.size_t
	ptr := C.totem_treekey_sign(t.handle, bytesPtr(data), C.size_t(len(data)), &outLen)
	if ptr == nil {
		return nil, ErrUnavailable
	}
	runtime.KeepAlive(data)
	return takeBytes(ptr, outLen), nil
}

// PublicKey returns the 32-byte root public key.
func (t *TreeKey) PublicKey() ([]byte, error) {
	var outLen C.size_t
	ptr := C.totem_treekey_get_public_key(t.handle, &outLen)
	if ptr == nil {
		return nil, ErrUnavailable
	}
	return takeBytes(ptr, outLen), nil
}

// Uses returns the number of signatures consumed.
func (t *TreeKey) Uses() uint32 { return uint32(C.totem_treekey_get_uses(t.handle)) }

// SetUses restores the use counter, enforcing forward-only progress so a WOTS
// leaf is never reused. It returns an error if `uses` would rewind the counter.
func (t *TreeKey) SetUses(uses uint32) error {
	if current := t.Uses(); uses < current {
		return fmt.Errorf("totemcrypto: refusing to lower uses from %d to %d (would reuse a leaf)", current, uses)
	}
	C.totem_treekey_set_uses(t.handle, C.uint32_t(uses))
	return nil
}

// MaxUses returns the maximum signatures this tree can produce.
func (t *TreeKey) MaxUses() uint32 { return uint32(C.totem_treekey_get_max_uses(t.handle)) }

// Free releases the native handle.
func (t *TreeKey) Free() {
	if t.handle != 0 {
		C.totem_treekey_free(t.handle)
		t.handle = 0
	}
}

// SerializeTreeSignature converts TreeSignature JSON to Java Streamable bytes.
func SerializeTreeSignature(sigJSON []byte) ([]byte, error) {
	csig := C.CString(string(sigJSON))
	defer C.free(unsafe.Pointer(csig))
	var outLen C.size_t
	var errOut *C.char
	ptr := C.totem_tree_signature_serialize(csig, &outLen, &errOut)
	if ptr == nil {
		return nil, fmt.Errorf("totemcrypto: serialize failed: %s", takeString(errOut))
	}
	return takeBytes(ptr, outLen), nil
}

// DeriveRootPrivSeed returns deriveRootPrivSeed(baseSeed) (32 bytes).
func DeriveRootPrivSeed(seed []byte) ([]byte, error) {
	var outLen C.size_t
	ptr := C.totem_derive_root_priv_seed(bytesPtr(seed), C.size_t(len(seed)), &outLen)
	if ptr == nil {
		return nil, ErrUnavailable
	}
	runtime.KeepAlive(seed)
	return takeBytes(ptr, outLen), nil
}

// DeriveUnifiedChildSeed returns the unified child seed for an address index.
func DeriveUnifiedChildSeed(baseSeed []byte, index uint32) ([]byte, error) {
	var outLen C.size_t
	ptr := C.totem_derive_unified_child_seed(bytesPtr(baseSeed), C.size_t(len(baseSeed)), C.uint32_t(index), &outLen)
	if ptr == nil {
		return nil, ErrUnavailable
	}
	runtime.KeepAlive(baseSeed)
	return takeBytes(ptr, outLen), nil
}

// DerivePerAddressSeed returns derivePerAddressSeed(rootSeed, addressIndex).
func DerivePerAddressSeed(rootSeed []byte, addressIndex uint32) ([]byte, error) {
	var outLen C.size_t
	ptr := C.totem_derive_per_address_seed(bytesPtr(rootSeed), C.size_t(len(rootSeed)), C.uint32_t(addressIndex), &outLen)
	if ptr == nil {
		return nil, ErrUnavailable
	}
	runtime.KeepAlive(rootSeed)
	return takeBytes(ptr, outLen), nil
}

// AddressFromPKDigest derives the Minima Mx address for a 32-byte pk digest.
func AddressFromPKDigest(pkDigest []byte) (string, error) {
	var outLen C.size_t
	ptr := C.totem_address_from_pk_digest(bytesPtr(pkDigest), C.size_t(len(pkDigest)), &outLen)
	if ptr == nil {
		return "", ErrUnavailable
	}
	runtime.KeepAlive(pkDigest)
	return string(takeBytes(ptr, outLen)), nil
}

// AddressFromFullPublicKey derives the Minima Mx address for a full 1088-byte pk.
func AddressFromFullPublicKey(pkFull []byte) (string, error) {
	var outLen C.size_t
	ptr := C.totem_address_from_full_public_key(bytesPtr(pkFull), C.size_t(len(pkFull)), &outLen)
	if ptr == nil {
		return "", ErrUnavailable
	}
	runtime.KeepAlive(pkFull)
	return string(takeBytes(ptr, outLen)), nil
}

// DeserializeTreeSignature converts Java Streamable bytes to TreeSignature JSON.
func DeserializeTreeSignature(bytes []byte) ([]byte, error) {
	var outLen C.size_t
	var errOut *C.char
	ptr := C.totem_tree_signature_deserialize(bytesPtr(bytes), C.size_t(len(bytes)), &outLen, &errOut)
	if ptr == nil {
		return nil, fmt.Errorf("totemcrypto: deserialize failed: %s", takeString(errOut))
	}
	runtime.KeepAlive(bytes)
	return takeBytes(ptr, outLen), nil
}

// VerifyTreeSignature verifies TreeSignature JSON against a root pubkey and a
// 32-byte message digest.
func VerifyTreeSignature(rootPk, message, sigJSON []byte) bool {
	csig := C.CString(string(sigJSON))
	defer C.free(unsafe.Pointer(csig))
	return C.totem_verify_tree_signature_json(bytesPtr(rootPk), C.size_t(len(rootPk)),
		bytesPtr(message), C.size_t(len(message)), csig) == 1
}

func takeString(p *C.char) string {
	if p == nil {
		return ""
	}
	s := C.GoString(p)
	C.totem_string_free(p)
	return s
}
