package lookupclient

import (
	"bytes"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/totem-sdk/core-ffi"
	"golang.org/x/crypto/sha3"
)

// RFC-032/033: the byte-exact WOTS signer is CoreWotsSigner (totemwots.go),
// backed by the shared Rust core via cgo and verified byte-for-byte against the
// TypeScript engine. Set config.IdentitySeed (or inject a WotsSigner) and the
// client signs real auth envelopes; without either, it fails closed.

// ProtocolVersion 2 is the RFC-032 hard switch: post-quantum WOTS auth, no
// Ed25519, no HELLO/AUTH_CHALLENGE/AUTH_RESPONSE handshake.
const ProtocolVersion = 2

// ErrNotInteroperable is returned when no signer is configured (no
// config.IdentitySeed and no injected WotsSigner). It is a configuration guard,
// not a crypto limitation — the crypto is available via CoreWotsSigner.
var ErrNotInteroperable = errors.New(
	"lookup-client(go): no WOTS signer configured (set LookupClientConfig.IdentitySeed or inject a WotsSigner)",
)

// WotsAuthEnvelope is the RFC-032 post-quantum auth envelope carried per message.
type WotsAuthEnvelope struct {
	RootPublicKey     string `json:"rootPublicKey"`
	Signature         string `json:"signature"`
	Nonce             int64  `json:"nonce"`
	ExpiresAt         int64  `json:"expiresAt"`
	RootIdentityProof string `json:"rootIdentityProof,omitempty"`
	Address           string `json:"address,omitempty"`
}

// SessionTicketRef is the RFC-032-A amortised-auth reference. `Seq` is a
// client-monotonic counter, so a replayed ticket-authenticated message is
// rejected by the node.
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

// DefaultAuthRequiredTypes mirrors the TypeScript client/node list: high-value
// or mutating messages must always carry a full WOTS envelope, never a ticket.
var DefaultAuthRequiredTypes = []string{
	"LEASE_RESERVE",
	"LEASE_COMMIT",
	"LEASE_BURN",
	"BROADCAST_TXPOW",
	"TRUST_RECORD",
	"APP_ANNOUNCE",
	"AGENT_ANNOUNCE",
	"POLICY_ANNOUNCE",
}

// WotsSigner signs the RFC-032 auth digest for an outgoing message. Implement
// this with a real WOTS/TreeKey signer. The digest is
// sha3_256(canonicalJson(message) ‖ nonce ‖ expiresAt); `Nonce()` must return
// the next (strictly increasing) one-time index that `Sign` will consume, and
// `Sign` must consume exactly that index.
type WotsSigner interface {
	RootPublicKey() string
	Nonce() int64
	Sign(digest []byte) (signature []byte, err error)
}

type LookupMessage struct {
	Type    string            `json:"type"`
	Version int               `json:"version"`
	ID      string            `json:"id,omitempty"`
	Auth    *WotsAuthEnvelope `json:"auth,omitempty"`
	Ticket  *SessionTicketRef `json:"ticket,omitempty"`
	Payload json.RawMessage   `json:"payload"`
}

type ITransport interface {
	Send(data []byte) error
	OnData(handler func([]byte))
	OnClose(handler func())
	OnError(handler func(error))
	Close() error
}

type LookupClientConfig struct {
	HyperswarmTopic string
	NodeURL         string
	TimeoutMs       time.Duration
	ReconnectBaseMs time.Duration
	ReconnectMaxMs  time.Duration
	// IdentitySeed (32 bytes) builds the RFC-032/033 WOTS lookup identity. When
	// set, the client signs with the byte-exact core crypto automatically. When
	// empty, the client fails closed (ErrNotInteroperable) unless a signer is
	// supplied via NewLookupClientWithSigner.
	IdentitySeed []byte
	// UseSessionTickets enables RFC-032-A: SESSION_OPEN consumes one WOTS use,
	// then non-high-value messages carry a `ticket` reference instead of a full
	// envelope. Falls back to per-message WOTS if the session cannot be opened.
	UseSessionTickets bool
	// SessionTTLMs is the requested ticket lifetime; the node clamps it.
	SessionTTLMs time.Duration
	// AuthRequiredTypes overrides the high-value types that must always use a
	// full WOTS envelope. Defaults to DefaultAuthRequiredTypes.
	AuthRequiredTypes []string
}

type Coin struct {
	CoinID  string `json:"coinid"`
	Amount  string `json:"amount"`
	Address string `json:"address"`
	TokenID string `json:"tokenid"`
	Spent   bool   `json:"spent,omitempty"`
}

type CoinsQuery struct {
	Address  string `json:"address,omitempty"`
	TokenID  string `json:"tokenId,omitempty"`
	Sendable bool   `json:"sendable,omitempty"`
	Relevant bool   `json:"relevant,omitempty"`
}

type ChainTip struct {
	Block int    `json:"block"`
	Hash  string `json:"hash"`
	Time  string `json:"time,omitempty"`
}

type MMRProof struct {
	CoinID string      `json:"coinid"`
	Data   interface{} `json:"data"`
}

type TokenInfo struct {
	TokenID string `json:"tokenid"`
	Name    string `json:"name,omitempty"`
	Ticker  string `json:"ticker,omitempty"`
}

type BroadcastResult struct {
	Success bool   `json:"success"`
	Message string `json:"message,omitempty"`
	TxpowID string `json:"txpowid,omitempty"`
}

type CoinUpdateEvent struct {
	EventType string      `json:"eventType"`
	Coin      interface{} `json:"coin"`
	Block     int         `json:"block"`
}

type CoinUpdateCallback func(event CoinUpdateEvent)

type Unsubscribe func()

type LookupClient struct {
	config           LookupClientConfig
	transport        ITransport
	rpc              *RpcLayer
	subscriptions    *SubscriptionManager
	signer           WotsSigner
	authTTLMs        time.Duration
	useTickets       bool
	authRequired     map[string]struct{}
	sessionTTL       time.Duration
	ticket           *SessionTicket
	ticketSeq        int64
	ticketMu         sync.Mutex
	reopenMu         sync.Mutex
	reopening        bool
	mu               sync.RWMutex
	destroyed        bool
	reconnectAttempt int
	handlers         map[string][]func(...interface{})
}

func NewLookupClient(config LookupClientConfig) (*LookupClient, error) {
	// RFC-032/033: build the byte-exact WOTS signer from the seed when provided,
	// so `NewLookupClient` is self-contained rather than fail-closed.
	if config.IdentitySeed != nil {
		signer, err := NewCoreWotsSigner(config.IdentitySeed)
		if err != nil {
			return nil, fmt.Errorf("lookup-client: build WOTS signer: %w", err)
		}
		return NewLookupClientWithSigner(config, signer)
	}
	return NewLookupClientWithSigner(config, nil)
}

// NewLookupClientWithSigner constructs a client with an explicit WOTS signer
// (RFC-032). When signer is nil, signed requests fail closed with
// ErrNotInteroperable rather than sending Ed25519.
func NewLookupClientWithSigner(config LookupClientConfig, signer WotsSigner) (*LookupClient, error) {
	if config.TimeoutMs == 0 {
		config.TimeoutMs = 10 * time.Second
	}
	if config.ReconnectBaseMs == 0 {
		config.ReconnectBaseMs = 1 * time.Second
	}
	if config.ReconnectMaxMs == 0 {
		config.ReconnectMaxMs = 30 * time.Second
	}

	c := &LookupClient{
		config:       config,
		signer:       signer,
		authTTLMs:    time.Minute,
		useTickets:   config.UseSessionTickets,
		authRequired: make(map[string]struct{}),
		sessionTTL:   config.SessionTTLMs,
		handlers:     make(map[string][]func(...interface{})),
	}
	required := config.AuthRequiredTypes
	if required == nil {
		required = DefaultAuthRequiredTypes
	}
	for _, typ := range required {
		c.authRequired[typ] = struct{}{}
	}
	c.rpc = NewRpcLayer(config.TimeoutMs)
	c.rpc.SetSigner(c)
	c.rpc.SetOnSessionExpired(func() {
		c.clearTicket()
		c.maybeReopenSession()
	})
	c.subscriptions = NewSubscriptionManager(c.rpc)
	return c, nil
}

// Stamp attaches a RFC-032 WOTS auth envelope to an outgoing message, or a
// RFC-032-A session-ticket reference when a valid ticket is held and the type
// allows amortised auth. Fails closed with ErrNotInteroperable when no signer
// is configured, or for unauthenticated liveness messages (HELLO/PING) which
// carry no envelope.
func (c *LookupClient) Stamp(msg *LookupMessage) error {
	if msg.Type == "HELLO" || msg.Type == "PING" {
		return nil
	}
	msg.Auth = nil
	msg.Ticket = nil

	if c.useTickets && msg.Type != "SESSION_OPEN" && msg.Type != "SESSION_CLOSE" && !c.isAuthRequired(msg.Type) {
		if ref := c.nextTicketRef(); ref != nil {
			msg.Ticket = ref
			return nil
		}
		if c.hasTicket() {
			// Expired or exhausted: fall back to a full envelope and refresh the
			// session in the background.
			c.maybeReopenSession()
		}
	}

	if c.signer == nil {
		return ErrNotInteroperable
	}
	expiresAt := time.Now().Add(c.authTTLMs).UnixMilli()
	nonce := c.signer.Nonce()
	digest, err := AuthDigest(*msg, nonce, expiresAt)
	if err != nil {
		return err
	}
	sig, err := c.signer.Sign(digest)
	if err != nil {
		return err
	}
	msg.Auth = &WotsAuthEnvelope{
		RootPublicKey: c.signer.RootPublicKey(),
		Signature:     hex.EncodeToString(sig),
		Nonce:         nonce,
		ExpiresAt:     expiresAt,
	}
	return nil
}

func (c *LookupClient) isAuthRequired(messageType string) bool {
	_, ok := c.authRequired[messageType]
	return ok
}

func (c *LookupClient) setTicket(ticket SessionTicket) error {
	if ticket.TicketID == "" {
		return errors.New("lookup-client: SESSION_TICKET has no ticketId")
	}
	if ticket.ExpiresAt <= time.Now().UnixMilli() {
		return errors.New("lookup-client: SESSION_TICKET is already expired")
	}
	if ticket.MaxRequests <= 0 {
		return errors.New("lookup-client: SESSION_TICKET has no request budget")
	}
	if c.signer != nil && ticket.Subject != c.signer.RootPublicKey() {
		return fmt.Errorf("lookup-client: SESSION_TICKET subject %q does not match identity %q", ticket.Subject, c.signer.RootPublicKey())
	}
	c.ticketMu.Lock()
	c.ticket = &ticket
	c.ticketSeq = 0
	c.ticketMu.Unlock()
	return nil
}

func (c *LookupClient) clearTicket() {
	c.ticketMu.Lock()
	c.ticket = nil
	c.ticketSeq = 0
	c.ticketMu.Unlock()
}

func (c *LookupClient) hasTicket() bool {
	c.ticketMu.Lock()
	defer c.ticketMu.Unlock()
	return c.ticket != nil
}

func (c *LookupClient) nextTicketRef() *SessionTicketRef {
	c.ticketMu.Lock()
	defer c.ticketMu.Unlock()
	if c.ticket == nil || time.Now().UnixMilli() > c.ticket.ExpiresAt {
		return nil
	}
	if c.ticket.MaxRequests > 0 && c.ticketSeq >= int64(c.ticket.MaxRequests) {
		return nil
	}
	ref := &SessionTicketRef{TicketID: c.ticket.TicketID, Seq: c.ticketSeq}
	c.ticketSeq++
	return ref
}

// openSession sends SESSION_OPEN (one WOTS use) and caches the returned ticket.
func (c *LookupClient) openSession() error {
	if c.signer == nil {
		return ErrNotInteroperable
	}
	c.clearTicket()
	payload := map[string]interface{}{}
	if c.sessionTTL > 0 {
		payload["ttlMs"] = c.sessionTTL.Milliseconds()
	}
	resp, err := c.rpc.SendRequest(LookupMessage{
		Type:    "SESSION_OPEN",
		Version: ProtocolVersion,
		Payload: mustMarshal(payload),
	})
	if err != nil {
		return err
	}
	if resp.Type != "SESSION_TICKET" {
		return fmt.Errorf("lookup-client: SESSION_OPEN did not return a ticket (got %s)", resp.Type)
	}
	var ticket SessionTicket
	if err := json.Unmarshal(resp.Payload, &ticket); err != nil {
		return fmt.Errorf("lookup-client: decode SESSION_TICKET: %w", err)
	}
	return c.setTicket(ticket)
}

// maybeReopenSession refreshes the ticket once in the background.
func (c *LookupClient) maybeReopenSession() {
	if !c.useTickets {
		return
	}
	c.reopenMu.Lock()
	if c.reopening {
		c.reopenMu.Unlock()
		return
	}
	c.reopening = true
	c.reopenMu.Unlock()

	go func() {
		defer func() {
			c.reopenMu.Lock()
			c.reopening = false
			c.reopenMu.Unlock()
		}()
		c.clearTicket()
		_ = c.openSession()
	}()
}

func (c *LookupClient) Connect(transport ITransport) error {
	c.mu.Lock()
	c.transport = transport
	c.mu.Unlock()

	c.rpc.Attach(transport)

	transport.OnClose(func() {
		c.mu.Lock()
		if !c.destroyed {
			c.clearTicket()
			c.transport = nil
			c.rpc.Detach()
			c.mu.Unlock()
			go c.scheduleReconnect()
		} else {
			c.mu.Unlock()
		}
	})

	transport.OnError(func(err error) {})

	// RFC-032-A: if tickets are enabled, open a session (one WOTS use) before
	// the first request. Failure falls back to per-message WOTS.
	if c.useTickets {
		c.clearTicket()
		_ = c.openSession()
	}

	// RFC-032: no handshake. Authentication is a WOTS auth envelope stamped on
	// every outgoing message (see Stamp / RpcLayer.SendRaw).
	c.subscriptions.ReRegisterAll()
	c.reconnectAttempt = 0
	c.emit("reconnected")
	return nil
}

func (c *LookupClient) scheduleReconnect() {
	c.mu.Lock()
	base := c.config.ReconnectBaseMs
	max := c.config.ReconnectMaxMs
	attempt := c.reconnectAttempt
	c.reconnectAttempt++
	c.mu.Unlock()

	delay := time.Duration(float64(base) * float64(int(1)<<uint(min(attempt, 10))))
	if delay > max {
		delay = max
	}

	c.emit("reconnecting", map[string]interface{}{"attempt": attempt + 1, "delayMs": delay.Milliseconds()})

	time.Sleep(delay)

	c.mu.Lock()
	if c.destroyed {
		c.mu.Unlock()
		return
	}
	c.mu.Unlock()
}

func (c *LookupClient) Disconnect() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.destroyed = true
	c.clearTicket()
	c.rpc.Detach()
	if c.transport != nil {
		c.transport.Close()
		c.transport = nil
	}
}

func (c *LookupClient) On(event string, handler func(...interface{})) Unsubscribe {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.handlers[event] = append(c.handlers[event], handler)
	return func() {
		c.mu.Lock()
		defer c.mu.Unlock()
		handlers := c.handlers[event]
		for i, h := range handlers {
			if fmt.Sprintf("%p", h) == fmt.Sprintf("%p", handler) {
				c.handlers[event] = append(handlers[:i], handlers[i+1:]...)
				break
			}
		}
	}
}

func (c *LookupClient) emit(event string, args ...interface{}) {
	c.mu.RLock()
	handlers := c.handlers[event]
	c.mu.RUnlock()
	for _, h := range handlers {
		h(args...)
	}
}

func (c *LookupClient) WatchAddress(address string) error {
	c.subscriptions.WatchAddress(address)
	return nil
}

func (c *LookupClient) SubscribeCoinUpdates(cb CoinUpdateCallback) Unsubscribe {
	return c.subscriptions.SubscribeCoinUpdates(cb)
}

func (c *LookupClient) GetCoins(query CoinsQuery) ([]Coin, error) {
	resp, err := c.rpc.SendRequest(LookupMessage{
		Type:    "GET_COINS",
		Version: ProtocolVersion,
		Payload: mustMarshal(query),
	})
	if err != nil {
		return nil, err
	}
	var p struct {
		Coins []Coin `json:"coins"`
	}
	json.Unmarshal(resp.Payload, &p)
	return p.Coins, nil
}

func (c *LookupClient) GetCoin(coinID string) (*Coin, error) {
	resp, err := c.rpc.SendRequest(LookupMessage{
		Type:    "GET_COIN",
		Version: ProtocolVersion,
		Payload: mustMarshal(map[string]string{"coinId": coinID}),
	})
	if err != nil {
		return nil, err
	}
	var p struct {
		Coin *Coin `json:"coin"`
	}
	json.Unmarshal(resp.Payload, &p)
	return p.Coin, nil
}

func (c *LookupClient) GetTip() (*ChainTip, error) {
	resp, err := c.rpc.SendRequest(LookupMessage{
		Type:    "GET_TIP",
		Version: ProtocolVersion,
		Payload: mustMarshal(map[string]interface{}{}),
	})
	if err != nil {
		return nil, err
	}
	var tip ChainTip
	json.Unmarshal(resp.Payload, &tip)
	return &tip, nil
}

func (c *LookupClient) GetToken(tokenID string) (*TokenInfo, error) {
	resp, err := c.rpc.SendRequest(LookupMessage{
		Type:    "GET_TOKEN",
		Version: ProtocolVersion,
		Payload: mustMarshal(map[string]string{"tokenId": tokenID}),
	})
	if err != nil {
		return nil, err
	}
	var p struct {
		Token TokenInfo `json:"token"`
	}
	json.Unmarshal(resp.Payload, &p)
	if p.Token.TokenID == "" {
		json.Unmarshal(resp.Payload, &p.Token)
	}
	return &p.Token, nil
}

func (c *LookupClient) BroadcastTxPoW(txpowHex string) (*BroadcastResult, error) {
	resp, err := c.rpc.SendRequest(LookupMessage{
		Type:    "BROADCAST_TXPOW",
		Version: ProtocolVersion,
		Payload: mustMarshal(map[string]string{"txpowHex": txpowHex}),
	})
	if err != nil {
		return nil, err
	}
	var result BroadcastResult
	json.Unmarshal(resp.Payload, &result)
	return &result, nil
}

type RpcLayer struct {
	mu               sync.Mutex
	pending          map[string]*pendingRequest
	pushHandlers     map[string][]func(LookupMessage)
	transport        ITransport
	stamper          Stamper
	onSessionExpired func()
	defaultTimeout   time.Duration
	idCounter        int
}

type pendingRequest struct {
	resolve chan LookupMessage
	reject  chan error
	timer   *time.Timer
}

func NewRpcLayer(defaultTimeout time.Duration) *RpcLayer {
	return &RpcLayer{
		pending:        make(map[string]*pendingRequest),
		pushHandlers:   make(map[string][]func(LookupMessage)),
		defaultTimeout: defaultTimeout,
	}
}

func (r *RpcLayer) Attach(transport ITransport) {
	r.mu.Lock()
	r.transport = transport
	r.mu.Unlock()

	transport.OnData(func(chunk []byte) {
		var msg LookupMessage
		if err := json.Unmarshal(chunk, &msg); err != nil {
			return
		}
		r.route(msg)
	})
}

func (r *RpcLayer) Detach() {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.transport = nil
	for id, p := range r.pending {
		p.timer.Stop()
		p.reject <- fmt.Errorf("connection lost")
		delete(r.pending, id)
	}
}

func (r *RpcLayer) route(msg LookupMessage) {
	r.mu.Lock()
	defer r.mu.Unlock()

	if msg.Type == "ERROR" {
		var errPayload struct {
			Code      string `json:"code"`
			Message   string `json:"message"`
			RequestID string `json:"requestId"`
		}
		json.Unmarshal(msg.Payload, &errPayload)
		if errPayload.Code == "SESSION_EXPIRED" || errPayload.Code == "AUTH_REPLAY" {
			if cb := r.onSessionExpired; cb != nil {
				go cb()
			}
		}
		if p, ok := r.pending[errPayload.RequestID]; ok {
			p.timer.Stop()
			p.reject <- fmt.Errorf("%s: %s", errPayload.Code, errPayload.Message)
			delete(r.pending, errPayload.RequestID)
		}
		return
	}

	if msg.ID != "" {
		if p, ok := r.pending[msg.ID]; ok {
			p.timer.Stop()
			p.resolve <- msg
			delete(r.pending, msg.ID)
			return
		}
	}

	if msg.Type == "PING" {
		var pingPayload struct {
			TS int64 `json:"ts"`
		}
		json.Unmarshal(msg.Payload, &pingPayload)
		r.SendRaw(LookupMessage{
			Type:    "PONG",
			Version: ProtocolVersion,
			Payload: mustMarshal(map[string]interface{}{"ts": time.Now().UnixMilli(), "echo": pingPayload.TS}),
		})
		return
	}

	if handlers, ok := r.pushHandlers[msg.Type]; ok {
		for _, h := range handlers {
			h(msg)
		}
	}
}

func (r *RpcLayer) SendRequest(msg LookupMessage) (LookupMessage, error) {
	r.mu.Lock()
	r.idCounter++
	id := fmt.Sprintf("req-%d", r.idCounter)
	msg.ID = id
	r.mu.Unlock()

	resolve := make(chan LookupMessage, 1)
	reject := make(chan error, 1)

	r.mu.Lock()
	r.pending[id] = &pendingRequest{
		resolve: resolve,
		reject:  reject,
		timer: time.AfterFunc(r.defaultTimeout, func() {
			r.mu.Lock()
			delete(r.pending, id)
			r.mu.Unlock()
			reject <- fmt.Errorf("request %s timed out", id)
		}),
	}
	r.mu.Unlock()

	if err := r.SendRaw(msg); err != nil {
		r.mu.Lock()
		if p, ok := r.pending[id]; ok {
			p.timer.Stop()
			delete(r.pending, id)
		}
		r.mu.Unlock()
		return LookupMessage{}, err
	}

	select {
	case resp := <-resolve:
		return resp, nil
	case err := <-reject:
		return LookupMessage{}, err
	}
}

// Stamper attaches a RFC-032 WOTS auth envelope to an outgoing message. The
// client implements it; the RPC layer calls it before every send.
type Stamper interface {
	Stamp(msg *LookupMessage) error
}

func (r *RpcLayer) SetSigner(s Stamper) {
	r.mu.Lock()
	r.stamper = s
	r.mu.Unlock()
}

// SetOnSessionExpired registers a callback invoked when the node rejects a
// ticket (SESSION_EXPIRED/AUTH_REPLAY), so the client can reopen the session.
func (r *RpcLayer) SetOnSessionExpired(cb func()) {
	r.mu.Lock()
	r.onSessionExpired = cb
	r.mu.Unlock()
}

func (r *RpcLayer) SendRaw(msg LookupMessage) error {
	r.mu.Lock()
	t := r.transport
	stamper := r.stamper
	r.mu.Unlock()
	// RFC-032: stamp a WOTS auth envelope before sending (fails closed if none).
	if stamper != nil {
		if err := stamper.Stamp(&msg); err != nil {
			return err
		}
	}
	if t == nil {
		return fmt.Errorf("not connected")
	}
	data, err := json.Marshal(msg)
	if err != nil {
		return err
	}
	return t.Send(data)
}

func (r *RpcLayer) OnPush(msgType string, handler func(LookupMessage)) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.pushHandlers[msgType] = append(r.pushHandlers[msgType], handler)
}

type SubscriptionManager struct {
	rpc       *RpcLayer
	addresses map[string]struct{}
	callbacks []CoinUpdateCallback
	mu        sync.Mutex
}

func NewSubscriptionManager(rpc *RpcLayer) *SubscriptionManager {
	s := &SubscriptionManager{
		rpc:       rpc,
		addresses: make(map[string]struct{}),
	}
	rpc.OnPush("COIN_UPDATE", func(msg LookupMessage) {
		var event CoinUpdateEvent
		json.Unmarshal(msg.Payload, &event)
		s.mu.Lock()
		callbacks := make([]CoinUpdateCallback, len(s.callbacks))
		copy(callbacks, s.callbacks)
		s.mu.Unlock()
		for _, cb := range callbacks {
			cb(event)
		}
	})
	return s
}

func (s *SubscriptionManager) WatchAddress(address string) {
	s.mu.Lock()
	s.addresses[address] = struct{}{}
	s.mu.Unlock()
	s.sendWatchRegister([]string{address})
}

func (s *SubscriptionManager) SubscribeCoinUpdates(cb CoinUpdateCallback) Unsubscribe {
	s.mu.Lock()
	s.callbacks = append(s.callbacks, cb)
	s.mu.Unlock()
	return func() {
		s.mu.Lock()
		defer s.mu.Unlock()
		for i, c := range s.callbacks {
			if fmt.Sprintf("%p", c) == fmt.Sprintf("%p", cb) {
				s.callbacks = append(s.callbacks[:i], s.callbacks[i+1:]...)
				break
			}
		}
	}
}

func (s *SubscriptionManager) ReRegisterAll() {
	s.mu.Lock()
	addrs := make([]string, 0, len(s.addresses))
	for a := range s.addresses {
		addrs = append(addrs, a)
	}
	s.mu.Unlock()
	if len(addrs) > 0 {
		s.sendWatchRegister(addrs)
	}
}

func (s *SubscriptionManager) sendWatchRegister(addresses []string) {
	s.rpc.SendRaw(LookupMessage{
		Type:    "WATCH_REGISTER",
		Version: ProtocolVersion,
		Payload: mustMarshal(map[string]interface{}{"addresses": addresses}),
	})
}

func mustMarshal(v interface{}) json.RawMessage {
	data, _ := json.Marshal(v)
	return data
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

// AuthDigest computes the RFC-032 signing digest:
//
//	sha3_256( canonicalJson({type,id,payload}) ‖ "|" ‖ nonce ‖ "|" ‖ expiresAt )
//
// It mirrors @totemsdk/lookup-protocol authDigest. The envelope is stripped
// before canonicalisation. NOTE: byte-exact agreement with the TypeScript
// canonicalJson is required for cross-language verification; this helper is a
// reference for a real Go signer/verifier and is not exercised by any test here.
func AuthDigest(msg LookupMessage, nonce int64, expiresAt int64) ([]byte, error) {
	// Match @totemsdk/lookup-protocol authDigest byte-for-byte: canonicalJson over
	// {type, id, payload} (sorted keys), then "|nonce|expiresAt", then SHA3-256.
	var payload interface{}
	if len(msg.Payload) > 0 {
		dec := json.NewDecoder(bytes.NewReader(msg.Payload))
		dec.UseNumber()
		if err := dec.Decode(&payload); err != nil {
			return nil, err
		}
	}
	inner := map[string]interface{}{
		"type":    msg.Type,
		"version": msg.Version,
		"payload": payload,
	}
	if msg.ID != "" {
		inner["id"] = msg.ID
	}
	canonical, err := totemcrypto.CanonicalJSON(inner)
	if err != nil {
		return nil, err
	}
	preimage := fmt.Sprintf("%s|%d|%d", canonical, nonce, expiresAt)
	h := sha3.New256()
	h.Write([]byte(preimage))
	return h.Sum(nil), nil
}
