package lookupclient

import (
	"encoding/json"
	"sync"
	"testing"
	"time"
)

// fakeSigner isolates the ticket tests from the expensive TreeKey derivation.
// The mock node does not verify the WOTS signature; the real signer is covered
// by the RFC-032/033 interop tests.
type fakeSigner struct {
	pub   string
	nonce int64
}

func (s *fakeSigner) RootPublicKey() string { return s.pub }
func (s *fakeSigner) Nonce() int64          { return s.nonce }
func (s *fakeSigner) Sign([]byte) ([]byte, error) {
	s.nonce++
	return []byte{1, 2, 3}, nil
}

// mockTransport is an in-memory duplex used by the ticket tests. The mock node
// reads `sent` and writes responses through `deliver` (the RpcLayer's OnData).
type mockTransport struct {
	sent   chan []byte
	mu     sync.Mutex
	onData func([]byte)
}

func newMockTransport() *mockTransport {
	return &mockTransport{sent: make(chan []byte, 64)}
}

func (m *mockTransport) Send(data []byte) error {
	m.sent <- append([]byte(nil), data...)
	return nil
}

func (m *mockTransport) OnData(handler func([]byte)) {
	m.mu.Lock()
	m.onData = handler
	m.mu.Unlock()
}

func (m *mockTransport) OnClose(func())      {}
func (m *mockTransport) OnError(func(error)) {}
func (m *mockTransport) Close() error        { return nil }

func (m *mockTransport) deliver(data []byte) {
	m.mu.Lock()
	handler := m.onData
	m.mu.Unlock()
	if handler != nil {
		handler(data)
	}
}

type mockNode struct {
	tr        *mockTransport
	subject   string
	stopCh    chan struct{}
	mu        sync.Mutex
	received  []LookupMessage
	expireOne bool
}

func newMockNode(tr *mockTransport, subject string) *mockNode {
	return &mockNode{tr: tr, subject: subject, stopCh: make(chan struct{})}
}

func (n *mockNode) run() {
	for {
		select {
		case raw := <-n.tr.sent:
			var msg LookupMessage
			if err := json.Unmarshal(raw, &msg); err != nil {
				continue
			}
			n.mu.Lock()
			n.received = append(n.received, msg)
			expire := n.expireOne
			if expire && msg.Type == "GET_TIP" {
				n.expireOne = false
			}
			n.mu.Unlock()
			n.respond(msg, expire)
		case <-n.stopCh:
			return
		}
	}
}

func (n *mockNode) respond(msg LookupMessage, expire bool) {
	switch msg.Type {
	case "SESSION_OPEN":
		now := time.Now().UnixMilli()
		ticket := SessionTicket{
			TicketID:    "tkt-1",
			Subject:     n.subject,
			NodeID:      "node-1",
			IssuedAt:    now,
			ExpiresAt:   now + int64(time.Minute/time.Millisecond),
			MaxRequests: 3,
			Signature:   "00",
		}
		n.tr.deliver(mustMarshal(LookupMessage{
			Type:    "SESSION_TICKET",
			Version: ProtocolVersion,
			ID:      msg.ID,
			Payload: mustMarshal(ticket),
		}))
	case "GET_TIP":
		if expire {
			n.tr.deliver(mustMarshal(LookupMessage{
				Type:    "ERROR",
				Version: ProtocolVersion,
				Payload: mustMarshal(map[string]string{
					"code":      "SESSION_EXPIRED",
					"message":   "ticket expired",
					"requestId": msg.ID,
				}),
			}))
			return
		}
		n.tr.deliver(mustMarshal(LookupMessage{
			Type:    "TIP",
			Version: ProtocolVersion,
			ID:      msg.ID,
			Payload: mustMarshal(map[string]interface{}{"block": 1, "hash": "00"}),
		}))
	}
}

func (n *mockNode) stop() { close(n.stopCh) }

func (n *mockNode) messages() []LookupMessage {
	n.mu.Lock()
	defer n.mu.Unlock()
	out := make([]LookupMessage, len(n.received))
	copy(out, n.received)
	return out
}

func (n *mockNode) countType(messageType string) int {
	count := 0
	for _, msg := range n.messages() {
		if msg.Type == messageType {
			count++
		}
	}
	return count
}

func newTicketTestClient(t *testing.T) (*LookupClient, *fakeSigner, *mockTransport, *mockNode) {
	t.Helper()
	signer := &fakeSigner{pub: "00"}
	tr := newMockTransport()
	node := newMockNode(tr, signer.RootPublicKey())
	go node.run()

	client, err := NewLookupClientWithSigner(LookupClientConfig{
		TimeoutMs:         2 * time.Second,
		UseSessionTickets: true,
		SessionTTLMs:      time.Minute,
	}, signer)
	if err != nil {
		t.Fatalf("client: %v", err)
	}
	if err := client.Connect(tr); err != nil {
		t.Fatalf("connect: %v", err)
	}
	return client, signer, tr, node
}

func TestSessionTicketsUseMonotonicRefs(t *testing.T) {
	client, _, _, node := newTicketTestClient(t)
	defer func() {
		client.Disconnect()
		node.stop()
	}()

	for i := 0; i < 2; i++ {
		if _, err := client.GetTip(); err != nil {
			t.Fatalf("get tip %d: %v", i, err)
		}
	}

	messages := node.messages()
	if got := node.countType("SESSION_OPEN"); got != 1 {
		t.Fatalf("expected 1 SESSION_OPEN, got %d", got)
	}
	var opens, tips []LookupMessage
	for _, msg := range messages {
		switch msg.Type {
		case "SESSION_OPEN":
			opens = append(opens, msg)
		case "GET_TIP":
			tips = append(tips, msg)
		}
	}
	if len(opens) != 1 || opens[0].Auth == nil || opens[0].Ticket != nil {
		t.Fatalf("SESSION_OPEN must carry WOTS auth and no ticket: %+v", opens)
	}
	if len(tips) != 2 {
		t.Fatalf("expected 2 GET_TIP, got %d", len(tips))
	}
	for i, msg := range tips {
		if msg.Auth != nil {
			t.Fatalf("GET_TIP[%d] should not carry auth", i)
		}
		if msg.Ticket == nil || msg.Ticket.Seq != int64(i) || msg.Ticket.TicketID != "tkt-1" {
			t.Fatalf("GET_TIP[%d] ticket ref = %+v", i, msg.Ticket)
		}
	}
}

func TestHighValueTypeStillUsesWotsAuth(t *testing.T) {
	client, _, _, node := newTicketTestClient(t)
	defer func() {
		client.Disconnect()
		node.stop()
	}()

	msg := LookupMessage{
		Type:    "BROADCAST_TXPOW",
		Version: ProtocolVersion,
		Payload: mustMarshal(map[string]string{"txpowHex": "00"}),
	}
	if err := client.Stamp(&msg); err != nil {
		t.Fatalf("stamp: %v", err)
	}
	if msg.Auth == nil {
		t.Fatal("BROADCAST_TXPOW must use a full WOTS envelope")
	}
	if msg.Ticket != nil {
		t.Fatal("BROADCAST_TXPOW must not use a session ticket")
	}
}

func TestSessionExpiredReopensTicket(t *testing.T) {
	client, _, _, node := newTicketTestClient(t)
	defer func() {
		client.Disconnect()
		node.stop()
	}()

	node.mu.Lock()
	node.expireOne = true
	node.mu.Unlock()

	if _, err := client.GetTip(); err == nil {
		t.Fatal("expected SESSION_EXPIRED error")
	}

	deadline := time.Now().Add(2 * time.Second)
	for time.Now().Before(deadline) && node.countType("SESSION_OPEN") < 2 {
		time.Sleep(10 * time.Millisecond)
	}
	if got := node.countType("SESSION_OPEN"); got < 2 {
		t.Fatalf("expected the client to reopen the session, got %d SESSION_OPEN", got)
	}

	if _, err := client.GetTip(); err != nil {
		t.Fatalf("get tip after reopen: %v", err)
	}
}
