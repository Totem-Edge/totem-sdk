package lookupclient

import (
	"crypto/ed25519"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"sync"
	"time"

	"golang.org/x/crypto/sha3"
)

const ProtocolVersion = 1

type LookupMessage struct {
	Type    string          `json:"type"`
	Version int             `json:"version"`
	ID      string          `json:"id,omitempty"`
	Payload json.RawMessage `json:"payload"`
}

type ITransport interface {
	Send(data []byte) error
	OnData(handler func([]byte))
	OnClose(handler func())
	OnError(handler func(error))
	Close() error
}

type LookupClientConfig struct {
	HyperswarmTopic  string
	NodeURL          string
	TimeoutMs        time.Duration
	ReconnectBaseMs  time.Duration
	ReconnectMaxMs   time.Duration
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
	config        LookupClientConfig
	transport     ITransport
	rpc           *RpcLayer
	subscriptions *SubscriptionManager
	pubKey        ed25519.PublicKey
	privKey       ed25519.PrivateKey
	pubKeyHex     string
	mu            sync.Mutex
	destroyed     bool
	reconnectAttempt int
	handlers      map[string][]func(...interface{})
}

func NewLookupClient(config LookupClientConfig) (*LookupClient, error) {
	if config.TimeoutMs == 0 {
		config.TimeoutMs = 10 * time.Second
	}
	if config.ReconnectBaseMs == 0 {
		config.ReconnectBaseMs = 1 * time.Second
	}
	if config.ReconnectMaxMs == 0 {
		config.ReconnectMaxMs = 30 * time.Second
	}

	pub, priv, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		return nil, fmt.Errorf("failed to generate identity keypair: %w", err)
	}

	c := &LookupClient{
		config:    config,
		pubKey:    pub,
		privKey:   priv,
		pubKeyHex: hex.EncodeToString(pub),
		handlers:  make(map[string][]func(...interface{})),
	}
	c.rpc = NewRpcLayer(config.TimeoutMs)
	c.subscriptions = NewSubscriptionManager(c.rpc)
	return c, nil
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

	if err := c.runAuthHandshake(); err != nil {
		return fmt.Errorf("auth handshake failed: %w", err)
	}

	c.subscriptions.ReRegisterAll()
	c.reconnectAttempt = 0
	c.emit("reconnected")
	return nil
}

func (c *LookupClient) runAuthHandshake() error {
	challengeMsg, err := c.rpc.SendRequest(LookupMessage{
		Type:    "HELLO",
		Version: ProtocolVersion,
		Payload: mustMarshal(map[string]interface{}{"clientVersion": ProtocolVersion}),
	})
	if err != nil {
		return err
	}

	if challengeMsg.Type != "AUTH_CHALLENGE" {
		return fmt.Errorf("expected AUTH_CHALLENGE, got %s", challengeMsg.Type)
	}

	var challengePayload struct {
		Challenge string `json:"challenge"`
		ExpiresAt int64  `json:"expiresAt"`
	}
	json.Unmarshal(challengeMsg.Payload, &challengePayload)

	sig := ed25519.Sign(c.privKey, []byte(challengePayload.Challenge))

	authMsg := LookupMessage{
		Type:    "AUTH_RESPONSE",
		Version: ProtocolVersion,
		Payload: mustMarshal(map[string]interface{}{
			"challenge": challengePayload.Challenge,
			"publicKey": c.pubKeyHex,
			"signature": hex.EncodeToString(sig),
		}),
	}

	_, err = c.rpc.SendRequest(authMsg)
	return err
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
	mu              sync.Mutex
	pending         map[string]*pendingRequest
	pushHandlers    map[string][]func(LookupMessage)
	transport       ITransport
	defaultTimeout  time.Duration
	idCounter       int
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
		var pingPayload struct{ TS int64 `json:"ts"` }
		json.Unmarshal(msg.Payload, &pingPayload)
		r.SendRaw(LookupMessage{
			Type:    "PONG",
			Version: 1,
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

func (r *RpcLayer) SendRaw(msg LookupMessage) error {
	r.mu.Lock()
	t := r.transport
	r.mu.Unlock()
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

func init() {
	_ = sha3.New256()
	_ = io.EOF
}
