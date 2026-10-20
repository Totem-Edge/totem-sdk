package lookupnode

import (
	"encoding/hex"
	"strconv"
	"sync"
	"time"

	"github.com/totem-sdk/core-ffi"
	"golang.org/x/crypto/sha3"
)

const nodeIdentityUsesKey = "totem_lookup_node_identity_uses:v1"

// SessionTicketRef is the RFC-032-A amortised-auth reference. Seq is a
// client-monotonic counter; the node rejects a replayed seq.
type SessionTicketRef struct {
	TicketID string `json:"ticketId"`
	Seq      int64  `json:"seq"`
}

// SessionTicket is the node-signed ticket returned by SESSION_OPEN.
type SessionTicket struct {
	TicketID    string `json:"ticketId"`
	Subject     string `json:"subject"`
	NodeID      string `json:"nodeId"`
	IssuedAt    int64  `json:"issuedAt"`
	ExpiresAt   int64  `json:"expiresAt"`
	MaxRequests int    `json:"maxRequests"`
	Signature   string `json:"signature"`
}

// TicketSigner signs a session ticket and identifies the node key.
type TicketSigner interface {
	PublicKey() string
	SignTicket(ticket SessionTicket) (string, error)
}

// SessionTicketDigest mirrors @totemsdk/lookup-protocol sessionTicketDigest:
//
//	sha3_256("totem:lookup:session-ticket:v1|" + canonicalJson(ticket - signature))
func SessionTicketDigest(ticket SessionTicket) ([]byte, error) {
	payload := map[string]interface{}{
		"ticketId":    ticket.TicketID,
		"subject":     ticket.Subject,
		"nodeId":      ticket.NodeID,
		"issuedAt":    ticket.IssuedAt,
		"expiresAt":   ticket.ExpiresAt,
		"maxRequests": ticket.MaxRequests,
	}
	canonical, err := totemcrypto.CanonicalJSON(payload)
	if err != nil {
		return nil, err
	}
	h := sha3.New256()
	h.Write([]byte("totem:lookup:session-ticket:v1|" + canonical))
	return h.Sum(nil), nil
}

// NodeIdentity is the node's WOTS/TreeKey identity used to sign tickets.
// Derivation matches the TypeScript NodeIdentity.fromNodeId:
// sha3_256("lookup-node-identity:" + nodeId) → per-address TreeKey(0).
type NodeIdentity struct {
	nodeID  string
	signer  *CoreWotsSigner
	persist func(uses uint32)
}

func newNodeIdentity(nodeID string, startUses uint32, persist func(uint32)) (*NodeIdentity, error) {
	seed := sha3.Sum256([]byte("lookup-node-identity:" + nodeID))
	signer, err := NewCoreWotsSigner(seed[:])
	if err != nil {
		return nil, err
	}
	if startUses > 0 {
		if err := signer.SetUses(startUses); err != nil {
			signer.Free()
			return nil, err
		}
	}
	return &NodeIdentity{nodeID: nodeID, signer: signer, persist: persist}, nil
}

func (n *NodeIdentity) PublicKey() string { return n.signer.RootPublicKey() }

func (n *NodeIdentity) SignTicket(ticket SessionTicket) (string, error) {
	digest, err := SessionTicketDigest(ticket)
	if err != nil {
		return "", err
	}
	sig, err := n.signer.Sign(digest)
	if err != nil {
		return "", err
	}
	if n.persist != nil {
		n.persist(n.signer.Uses())
	}
	return hex.EncodeToString(sig), nil
}

func (n *NodeIdentity) Free() { n.signer.Free() }

// getTicketSigner lazily builds the node identity and restores its WOTS use
// counter forward-only. A caller-supplied TicketSigner bypasses derivation.
func (n *LookupNode) getTicketSigner() (TicketSigner, error) {
	if n.config.TicketSigner != nil {
		return n.config.TicketSigner, nil
	}
	n.ticketOnce.Do(func() {
		var startUses uint32
		if raw, ok := n.store.KVGet(nodeIdentityUsesKey); ok {
			if parsed, err := strconv.ParseUint(raw, 10, 32); err == nil {
				startUses = uint32(parsed)
			}
		}
		n.ticketSigner, n.ticketErr = newNodeIdentity(n.nodeID, startUses, func(uses uint32) {
			n.store.KVSet(nodeIdentityUsesKey, strconv.FormatUint(uint64(uses), 10))
		})
	})
	return n.ticketSigner, n.ticketErr
}

type ticketState struct {
	subject     string
	nodeID      string
	expiresAt   int64
	maxRequests int
	lastSeq     int64
	requests    int
	revoked     bool
}

// SessionTicketStore mirrors the TypeScript ticket store: bounded, expiring,
// per-ticket seq monotonicity, subject binding and revocation.
type SessionTicketStore struct {
	mu         sync.Mutex
	tickets    map[string]*ticketState
	order      []string
	maxTickets int
	now        func() int64
}

func NewSessionTicketStore() *SessionTicketStore {
	return &SessionTicketStore{
		tickets:    make(map[string]*ticketState),
		maxTickets: 4096,
		now:        func() int64 { return time.Now().UnixMilli() },
	}
}

func (s *SessionTicketStore) Issue(ticket SessionTicket) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.pruneLocked()
	for len(s.tickets) >= s.maxTickets && len(s.order) > 0 {
		id := s.order[0]
		s.order = s.order[1:]
		delete(s.tickets, id)
	}
	s.tickets[ticket.TicketID] = &ticketState{
		subject:     ticket.Subject,
		nodeID:      ticket.NodeID,
		expiresAt:   ticket.ExpiresAt,
		maxRequests: ticket.MaxRequests,
		lastSeq:     -1,
	}
	s.order = append(s.order, ticket.TicketID)
}

// Consume validates a ticket ref and advances its seq on success. The returned
// reason is empty on success, otherwise one of unknown/expired/revoked/
// exhausted/replay.
func (s *SessionTicketStore) Consume(ticketID string, seq int64, expectedSubject string) (string, string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	state, ok := s.tickets[ticketID]
	if !ok {
		return "", "unknown"
	}
	if state.revoked {
		return "", "revoked"
	}
	if s.now() > state.expiresAt {
		return "", "expired"
	}
	if state.requests >= state.maxRequests {
		return "", "exhausted"
	}
	if seq <= state.lastSeq {
		return "", "replay"
	}
	if expectedSubject != "" && expectedSubject != state.subject {
		return "", "unknown"
	}
	state.lastSeq = seq
	state.requests++
	return state.subject, ""
}

func (s *SessionTicketStore) Revoke(ticketID string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if state, ok := s.tickets[ticketID]; ok {
		state.revoked = true
	}
}

func (s *SessionTicketStore) Size() int {
	s.mu.Lock()
	defer s.mu.Unlock()
	return len(s.tickets)
}

func (s *SessionTicketStore) pruneLocked() {
	kept := s.order[:0]
	for _, id := range s.order {
		state, ok := s.tickets[id]
		if !ok {
			continue
		}
		if state.revoked || s.now() > state.expiresAt {
			delete(s.tickets, id)
			continue
		}
		kept = append(kept, id)
	}
	s.order = kept
}
