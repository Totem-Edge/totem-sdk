package lookupnode

import (
	"encoding/json"
	"sync"
	"testing"
	"time"
)

type ticketProvider struct{}

func (ticketProvider) GetCoins(CoinsQuery) ([]Coin, error) { return nil, nil }
func (ticketProvider) GetCoin(string) (*Coin, error)       { return nil, nil }
func (ticketProvider) GetTip() (*ChainTip, error) {
	return &ChainTip{Block: 1, Hash: "00"}, nil
}
func (ticketProvider) GetToken(string) (*TokenInfo, error) { return nil, nil }
func (ticketProvider) BroadcastTxPoW(string) (*BroadcastResult, error) {
	return &BroadcastResult{Success: true}, nil
}

type testVerifier struct{}

func (testVerifier) Verify(root string, _ []byte, signature string) bool {
	return root == "client-pub" && signature == "sig"
}

type testTicketSigner struct{}

func (testTicketSigner) PublicKey() string { return "node-pub" }
func (testTicketSigner) SignTicket(SessionTicket) (string, error) {
	return "ticket-sig", nil
}

type nodeTestTransport struct {
	sent   chan []byte
	mu     sync.Mutex
	onData func([]byte)
}

func newNodeTestTransport() *nodeTestTransport {
	return &nodeTestTransport{sent: make(chan []byte, 64)}
}

func (m *nodeTestTransport) Send(data []byte) error {
	m.sent <- append([]byte(nil), data...)
	return nil
}

func (m *nodeTestTransport) OnData(handler func([]byte)) {
	m.mu.Lock()
	m.onData = handler
	m.mu.Unlock()
}

func (m *nodeTestTransport) OnClose(func())      {}
func (m *nodeTestTransport) OnError(func(error)) {}
func (m *nodeTestTransport) Close() error        { return nil }

func (m *nodeTestTransport) deliver(data []byte) {
	m.mu.Lock()
	handler := m.onData
	m.mu.Unlock()
	if handler != nil {
		handler(data)
	}
}

func newTicketNode(t *testing.T) (*LookupNode, *nodeTestTransport) {
	t.Helper()
	node, err := NewLookupNode(LookupNodeConfig{
		Provider:           ticketProvider{},
		DBPath:             ":memory:",
		NodeID:             "node-test",
		Verifier:           testVerifier{},
		TicketSigner:       testTicketSigner{},
		SessionTTLMs:       time.Minute,
		SessionMaxRequests: 3,
	})
	if err != nil {
		t.Fatalf("new node: %v", err)
	}
	tr := newNodeTestTransport()
	node.HandleConnection(tr)
	return node, tr
}

func sendToNode(t *testing.T, tr *nodeTestTransport, msg LookupMessage) {
	t.Helper()
	data, err := json.Marshal(msg)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	tr.deliver(data)
}

func recvFromNode(t *testing.T, tr *nodeTestTransport) LookupMessage {
	t.Helper()
	select {
	case raw := <-tr.sent:
		var msg LookupMessage
		if err := json.Unmarshal(raw, &msg); err != nil {
			t.Fatalf("unmarshal: %v", err)
		}
		return msg
	case <-time.After(2 * time.Second):
		t.Fatal("timed out waiting for node response")
		return LookupMessage{}
	}
}

func clientAuth(nonce, expiresAt int64) *WotsAuthEnvelope {
	return &WotsAuthEnvelope{
		RootPublicKey: "client-pub",
		Signature:     "sig",
		Nonce:         nonce,
		ExpiresAt:     expiresAt,
	}
}

func TestSessionOpenMintsTicketAndTicketAuth(t *testing.T) {
	node, tr := newTicketNode(t)
	defer node.Stop()

	expires := time.Now().Add(time.Minute).UnixMilli()
	sendToNode(t, tr, LookupMessage{
		Type:    "SESSION_OPEN",
		Version: ProtocolVersion,
		ID:      "open-1",
		Auth:    clientAuth(0, expires),
		Payload: mustMarshal(map[string]interface{}{"ttlMs": 60_000}),
	})
	resp := recvFromNode(t, tr)
	if resp.Type != "SESSION_TICKET" {
		t.Fatalf("SESSION_OPEN response type = %s", resp.Type)
	}
	var ticket SessionTicket
	if err := json.Unmarshal(resp.Payload, &ticket); err != nil {
		t.Fatalf("ticket decode: %v", err)
	}
	if ticket.Subject != "client-pub" || ticket.NodeID != "node-test" {
		t.Fatalf("ticket binding = %+v", ticket)
	}
	if ticket.MaxRequests != 3 || ticket.Signature != "ticket-sig" {
		t.Fatalf("ticket budget/signature = %+v", ticket)
	}

	getTip := func(id string, seq int64) LookupMessage {
		return LookupMessage{
			Type:    "GET_TIP",
			Version: ProtocolVersion,
			ID:      id,
			Ticket:  &SessionTicketRef{TicketID: ticket.TicketID, Seq: seq},
		}
	}

	sendToNode(t, tr, getTip("tip-1", 0))
	if resp := recvFromNode(t, tr); resp.Type != "TIP_RESPONSE" {
		t.Fatalf("ticket-authenticated GET_TIP type = %s", resp.Type)
	}

	sendToNode(t, tr, getTip("tip-replay", 0))
	if resp := recvFromNode(t, tr); resp.Type != "ERROR" {
		t.Fatalf("replayed ticket seq should error, got %s", resp.Type)
	}

	sendToNode(t, tr, getTip("tip-2", 1))
	if resp := recvFromNode(t, tr); resp.Type != "TIP_RESPONSE" {
		t.Fatalf("second ticket seq type = %s", resp.Type)
	}

	sendToNode(t, tr, LookupMessage{
		Type:    "SESSION_CLOSE",
		Version: ProtocolVersion,
		ID:      "close-1",
		Payload: mustMarshal(map[string]string{"ticketId": ticket.TicketID}),
	})
	if resp := recvFromNode(t, tr); resp.Type != "PONG" {
		t.Fatalf("SESSION_CLOSE response type = %s", resp.Type)
	}

	sendToNode(t, tr, getTip("tip-revoked", 2))
	if resp := recvFromNode(t, tr); resp.Type != "ERROR" {
		t.Fatalf("revoked ticket should error, got %s", resp.Type)
	}
}

func TestHighValueTypeRejectsTicket(t *testing.T) {
	node, tr := newTicketNode(t)
	defer node.Stop()

	expires := time.Now().Add(time.Minute).UnixMilli()
	sendToNode(t, tr, LookupMessage{
		Type:    "SESSION_OPEN",
		Version: ProtocolVersion,
		ID:      "open-1",
		Auth:    clientAuth(0, expires),
	})
	resp := recvFromNode(t, tr)
	var ticket SessionTicket
	if err := json.Unmarshal(resp.Payload, &ticket); err != nil {
		t.Fatalf("ticket decode: %v", err)
	}

	sendToNode(t, tr, LookupMessage{
		Type:    "BROADCAST_TXPOW",
		Version: ProtocolVersion,
		ID:      "broadcast-1",
		Ticket:  &SessionTicketRef{TicketID: ticket.TicketID, Seq: 0},
		Payload: mustMarshal(map[string]string{"txpowHex": "00"}),
	})
	resp = recvFromNode(t, tr)
	if resp.Type != "ERROR" {
		t.Fatalf("BROADCAST_TXPOW should reject a ticket, got %s", resp.Type)
	}
}

func TestSessionTicketStoreBudgetExpirySubject(t *testing.T) {
	store := NewSessionTicketStore()
	now := int64(1_000)
	store.now = func() int64 { return now }
	store.Issue(SessionTicket{
		TicketID:    "tkt-1",
		Subject:     "subject-a",
		NodeID:      "node",
		ExpiresAt:   2_000,
		MaxRequests: 2,
	})

	if _, reason := store.Consume("tkt-1", 0, ""); reason != "" {
		t.Fatalf("seq 0: %s", reason)
	}
	if _, reason := store.Consume("tkt-1", 0, ""); reason != "replay" {
		t.Fatalf("replay: %s", reason)
	}
	if _, reason := store.Consume("tkt-1", 1, "other"); reason != "unknown" {
		t.Fatalf("subject: %s", reason)
	}
	if _, reason := store.Consume("tkt-1", 1, ""); reason != "" {
		t.Fatalf("seq 1: %s", reason)
	}
	if _, reason := store.Consume("tkt-1", 2, ""); reason != "exhausted" {
		t.Fatalf("exhausted: %s", reason)
	}

	store.Issue(SessionTicket{TicketID: "tkt-2", Subject: "subject-a", ExpiresAt: 2_500, MaxRequests: 1})
	now = 3_000
	if _, reason := store.Consume("tkt-2", 0, ""); reason != "expired" {
		t.Fatalf("expired: %s", reason)
	}
}
