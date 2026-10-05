package seserver

import (
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"time"

	"github.com/totem-sdk/core-ffi"
)

func nowISO() string { return time.Now().UTC().Format("2006-01-02T15:04:05.000Z") }

func sortStrings(s []string) { sort.Strings(s) }

// RFC-008 Phase 1 — SE identity with leased one-time WOTS leaves.
//
// The SE is NOT a single reused leaf at index 0 (the AUD-003/AUD-025 defect).
// It is the unified root identity of `seed`:
//
//   - the **root** TreeKey is the published anchor; it signs the versioned
//     ownership proof over the child slot(s) the SE signs from, and
//   - **child** TreeKey leaves sign at most one message each.
//
// Leaf allocation is a forward-only, durable watermark (`se_identity_watermark`):
// every signature leases the next leaf index, signs, and the counter never
// rewinds — so reuse is impossible across restarts and concurrent requests.
//
// This mirrors the TypeScript `SeIdentity` and is byte-compatible with it: the
// child leaves and the root anchor are derived with the same Rust core the TS
// engine uses (RFC-033).

const (
	seWatermarkSlot      = "se-identity"
	seOwnershipOp        = "TOTEM_OWNERSHIP_PROOF_V1"
	seDefaultProofVer    = 1
	seChildIndex         = 0
	seMaxUsesPerChildKey = 64 * 64 * 64 // 262,144
)

// WotsProof mirrors the TS `WotsProof` (lower-case hex, no 0x prefix).
type WotsProof struct {
	Address   string `json:"address"`
	PublicKey string `json:"publicKey"`
	Signature string `json:"signature"`
	Message   string `json:"message"`
}

// OwnershipProof mirrors the TS `OwnershipProof`.
type OwnershipProof struct {
	RootAddress      string    `json:"rootAddress"`
	RootPublicKey    string    `json:"rootPublicKey"`
	ChildAddresses   []string  `json:"childAddresses"`
	ChildPublicKeys  []string  `json:"childPublicKeys"`
	RootProof        WotsProof `json:"rootProof"`
	Timestamp        string    `json:"timestamp"`
}

// SeSignature mirrors the TS `SeSignature`.
type SeSignature struct {
	Kind         string `json:"kind"` // "child" | "root"
	Member       string `json:"member"`
	ChildIndex   int    `json:"childIndex"`
	Address      string `json:"address"`
	PublicKey    string `json:"publicKey"`
	Signature    string `json:"signature"`
	Message      string `json:"message"`
	ProofVersion int    `json:"proofVersion"`
}

// SePublishedIdentity mirrors the TS `SePublishedIdentity`.
type SePublishedIdentity struct {
	RootAddress    string         `json:"rootAddress"`
	RootPublicKey  string         `json:"rootPublicKey"`
	ProofVersion   int            `json:"proofVersion"`
	OwnershipProof OwnershipProof `json:"ownershipProof"`
}

// WatermarkAllocator leases the next one-time leaf index for a slot. It MUST be
// forward-only (never return the same index twice for a slot).
type WatermarkAllocator func(slot string) (int64, error)

// SeIdentity is the Go SE identity (RFC-008).
type SeIdentity struct {
	alloc        WatermarkAllocator
	baseSeed     []byte
	childIndex   uint32
	proofVersion int

	root      *totemcrypto.TreeKey
	child     *totemcrypto.TreeKey
	rootPub   string
	rootAddr  string
	childPub  string
	childAddr string
	ownership OwnershipProof
}

// NewSeIdentity builds the SE identity anchored on `seed` and leases leaves from
// the durable Postgres watermark. The child slot (0) is proven by the root key.
func NewSeIdentity(db *sql.DB, seed []byte) (*SeIdentity, error) {
	return newSeIdentity(seed, func(slot string) (int64, error) {
		return allocateWatermark(db, slot)
	})
}

// newSeIdentity is the allocation-injectable constructor (tests use an in-memory
// allocator instead of Postgres).
func newSeIdentity(seed []byte, alloc WatermarkAllocator) (*SeIdentity, error) {
	if len(seed) != 32 {
		return nil, fmt.Errorf("se identity: seed must be 32 bytes, got %d", len(seed))
	}
	root, err := totemcrypto.NewUnifiedRootTreeKey(seed)
	if err != nil {
		return nil, fmt.Errorf("se identity: root key: %w", err)
	}
	child, err := totemcrypto.NewUnifiedChildTreeKey(seed, seChildIndex)
	if err != nil {
		root.Free()
		return nil, fmt.Errorf("se identity: child key: %w", err)
	}

	rootPubBytes, err := root.PublicKey()
	if err != nil {
		root.Free()
		child.Free()
		return nil, err
	}
	childPubBytes, err := child.PublicKey()
	if err != nil {
		root.Free()
		child.Free()
		return nil, err
	}
	rootPub := hex.EncodeToString(rootPubBytes)
	childPub := hex.EncodeToString(childPubBytes)
	rootAddr, err := totemcrypto.AddressFromPKDigest(rootPubBytes)
	if err != nil {
		root.Free()
		child.Free()
		return nil, err
	}
	childAddr, err := totemcrypto.AddressFromPKDigest(childPubBytes)
	if err != nil {
		root.Free()
		child.Free()
		return nil, err
	}

	id := &SeIdentity{
		alloc:        alloc,
		baseSeed:     seed,
		childIndex:   seChildIndex,
		proofVersion: seDefaultProofVer,
		root:         root,
		child:        child,
		rootPub:      rootPub,
		rootAddr:     rootAddr,
		childPub:     childPub,
		childAddr:    childAddr,
	}

	// Build + sign the ownership proof over the child slot. Deriving it reuses
	// the root key's next leaf; the TS wallet tracks this with a watermark too,
	// but the SE only mints a proof once at startup (before any root signing),
	// so use leaf 0 and persist it.
	proof, err := id.buildOwnershipProof()
	if err != nil {
		root.Free()
		child.Free()
		return nil, err
	}
	id.ownership = proof
	return id, nil
}

// Free releases native handles.
func (id *SeIdentity) Free() {
	if id.root != nil {
		id.root.Free()
	}
	if id.child != nil {
		id.child.Free()
	}
}

func (id *SeIdentity) buildOwnershipProof() (OwnershipProof, error) {
	// Sign the canonical ownership message with the root key. Lease a fresh root
	// leaf from the durable watermark too, so a restart never reuses the root
	// leaf that signed a previous proof.
	rootUse, err := id.alloc(seWatermarkSlot+":root")
	if err != nil {
		return OwnershipProof{}, err
	}
	timestamp := nowISO()
	msg := ownershipMessage(id.rootAddr, []string{id.childPub}, timestamp)
	if err := id.root.SetUses(uint32(rootUse)); err != nil {
		return OwnershipProof{}, err
	}
	digest, err := totemcrypto.Sha3256([]byte(msg))
	if err != nil {
		return OwnershipProof{}, err
	}
	sigBytes, err := id.root.Sign(digest)
	if err != nil {
		return OwnershipProof{}, err
	}
	sigJSON, err := totemcrypto.SerializeTreeSignature(sigBytes)
	if err != nil {
		return OwnershipProof{}, err
	}
	return OwnershipProof{
		RootAddress:     id.rootAddr,
		RootPublicKey:   id.rootPub,
		ChildAddresses:  []string{id.childAddr},
		ChildPublicKeys: []string{id.childPub},
		RootProof: WotsProof{
			Address:   id.rootAddr,
			PublicKey: id.rootPub,
			Signature: hex.EncodeToString(sigJSON),
			Message:   msg,
		},
		Timestamp: timestamp,
	}, nil
}

// GetPublishedIdentity returns the published root anchor + ownership proof.
func (id *SeIdentity) GetPublishedIdentity() SePublishedIdentity {
	return SePublishedIdentity{
		RootAddress:    id.rootAddr,
		RootPublicKey:  id.rootPub,
		ProofVersion:   id.proofVersion,
		OwnershipProof: id.ownership,
	}
}

// signLeased leases the next one-time child leaf via the durable watermark,
// signs `message`, and returns the SE signature.
func (id *SeIdentity) signLeased(message string) (SeSignature, error) {
	use, err := id.alloc(seWatermarkSlot)
	if err != nil {
		return SeSignature{}, fmt.Errorf("se identity: lease leaf: %w", err)
	}
	if use >= seMaxUsesPerChildKey {
		return SeSignature{}, errors.New("se identity: leaf space exhausted; rotate the identity")
	}
	// Sign exactly at the leased leaf, never below it (set_uses is forward-only).
	if err := id.child.SetUses(uint32(use)); err != nil {
		return SeSignature{}, err
	}
	// Hash the message with SHA3-256 first, matching TS `signFromChild`
	// (Rust WOTS takes a 32-byte message and hashes it internally).
	digest, err := totemcrypto.Sha3256([]byte(message))
	if err != nil {
		return SeSignature{}, err
	}
	sigBytes, err := id.child.Sign(digest)
	if err != nil {
		return SeSignature{}, err
	}
	sigJSON, err := totemcrypto.SerializeTreeSignature(sigBytes)
	if err != nil {
		return SeSignature{}, err
	}
	return SeSignature{
		Kind:         "child",
		Member:       "se:" + short16(id.rootPub),
		ChildIndex:   int(id.childIndex),
		Address:      id.childAddr,
		PublicKey:    id.childPub,
		Signature:    hex.EncodeToString(sigJSON),
		Message:      message,
		ProofVersion: id.proofVersion,
	}, nil
}

// Sign produces the off-chain transfer blind-signature (leased child leaf).
func (id *SeIdentity) Sign(message string) (SeSignature, error) {
	return id.signLeased(message)
}

// ownershipMessage builds the canonical ownership-proof message (sorted child
// keys), byte-identical to TS `buildOwnershipMessage`.
func ownershipMessage(rootAddress string, childPublicKeys []string, timestamp string) string {
	keys := make([]string, len(childPublicKeys))
	copy(keys, childPublicKeys)
	sortStrings(keys)
	b, _ := json.Marshal(struct {
		Op              string   `json:"op"`
		RootAddress     string   `json:"rootAddress"`
		ChildPublicKeys []string `json:"childPublicKeys"`
		Timestamp       string   `json:"timestamp"`
	}{seOwnershipOp, rootAddress, keys, timestamp})
	return string(b)
}

func short16(s string) string {
	if len(s) > 16 {
		return s[:16]
	}
	return s
}
