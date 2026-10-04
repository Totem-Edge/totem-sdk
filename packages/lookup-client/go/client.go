package lookupclient

import (
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"sync"
	"time"

	"golang.org/x/crypto/sha3"
)

// NOTE: this Go mirror has no byte-exact WOTS signer/verifier (same gap as
// @totemsdk/se-server, AUD-045). A caller must supply a WotsSigner whose digest
// preimage matches @totemsdk/lookup-protocol authDigest exactly; otherwise
// requests fail closed. The TypeScript package is the supported implementation.

// ProtocolVersion 2 is the RFC-032 hard switch: post-quantum WOTS auth, no
// Ed25519, no HELLO/AUTH_CHALLENGE/AUTH_RESPONSE handshake.
const ProtocolVersion = 2

// ErrNotInteroperable marks the Go lookup-client signing surface as disabled.
// There is no interoperable WOTS/TreeKey implementation in Go yet (the same
// situation as @totemsdk/se-server AUD-045). Rather than emit placeholder
// cryptography that a lookup node could mistake for a valid WOTS signature, the
// signer fails closed. Use the TypeScript @totemsdk/lookup-client, or supply a
// real WotsSigner once a byte-exact WOTS port with cross-language tests lands.
var ErrNotInteroperable = errors.New(
	"lookup-client(go): not an interoperable WOTS client (RFC-032); use the TypeScript @totemsdk/lookup-client",
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
	mu               sync.RWMutex
	destroyed        bool
	reconnectAttempt int
	handlers         map[string][]func(...interface{})
}

func NewLookupClient(config LookupClientConfig) (*LookupClient, error) {
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
		config:    config,
		signer:    signer,
		authTTLMs: time.Minute,
		handlers:  make(map[string][]func(...interface{})),
	}
	c.rpc = NewRpcLayer(config.TimeoutMs)
	c.rpc.SetSigner(c)
	c.subscriptions = NewSubscriptionManager(c.rpc)
	return c, nil
}

// Stamp attaches a RFC-032 WOTS auth envelope to an outgoing message. Fails
// closed with ErrNotInteroperable when no signer is configured, or for
// unauthenticated liveness messages (HELLO/PING) which carry no envelope.
func (c *LookupClient) Stamp(msg *LookupMessage) error {
	if msg.Type == "HELLO" || msg.Type == "PING" {
		return nil
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

func (c *LookupClient) Connect(transport ITransport) error {
	c.mu.Lock()
	c.transport = transport
	c.mu.Unlock()

	c.rpc.Attach(transport)

	transport.OnClose(func() {
		c.mu.Lock()
		if !c.destroyed {
			c.transport = nil
			c.rpc.Detach()
			c.mu.Unlock()
			go c.scheduleReconnect()
		} else {
			c.mu.Unlock()
		}
	})

	transport.OnError(func(err error) {})

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
	mu             sync.Mutex
	pending        map[string]*pendingRequest
	pushHandlers   map[string][]func(LookupMessage)
	transport      ITransport
	stamper        Stamper
	defaultTimeout time.Duration
	idCounter      int
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
	inner := struct {
		Type    string          `json:"type"`
		Version int             `json:"version"`
		ID      string          `json:"id,omitempty"`
		Payload json.RawMessage `json:"payload"`
	}{msg.Type, msg.Version, msg.ID, msg.Payload}
	canonical, err := canonicalJSON(inner)
	if err != nil {
		return nil, err
	}
	preimage := fmt.Sprintf("%s|%d|%d", canonical, nonce, expiresAt)
	h := sha3.New256()
	h.Write([]byte(preimage))
	return h.Sum(nil), nil
}

// canonicalJSON marshals v with deterministic key ordering. json.Marshal of a
// struct already emits fields in declaration order; for maps Go sorts keys, so
// this is stable for the auth preimage shape.
func canonicalJSON(v interface{}) (string, error) {
	b, err := json.Marshal(v)
	if err != nil {
		return "", err
	}
	return string(b), nil
}
