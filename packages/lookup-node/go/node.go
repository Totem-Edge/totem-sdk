package lookupnode

import (
	"crypto/ed25519"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"sync"
	"time"

	_ "github.com/mattn/go-sqlite3"
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

type ChainStateProvider interface {
	GetCoins(query CoinsQuery) ([]Coin, error)
	GetCoin(coinID string) (*Coin, error)
	GetTip() (*ChainTip, error)
	GetToken(tokenID string) (*TokenInfo, error)
	BroadcastTxPoW(txpowHex string) (*BroadcastResult, error)
}

type CoinsQuery struct {
	Address  string `json:"address,omitempty"`
	TokenID  string `json:"tokenId,omitempty"`
	Sendable bool   `json:"sendable,omitempty"`
	Relevant bool   `json:"relevant,omitempty"`
}

type Coin struct {
	CoinID  string `json:"coinid"`
	Amount  string `json:"amount"`
	Address string `json:"address"`
	TokenID string `json:"tokenid"`
	Spent   bool   `json:"spent,omitempty"`
}

type ChainTip struct {
	Block int    `json:"block"`
	Hash  string `json:"hash"`
	Time  string `json:"time,omitempty"`
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

type LookupNodeConfig struct {
	Provider        ChainStateProvider
	PollIntervalMs  time.Duration
	ChallengeTTLMs  time.Duration
	RateLimitRPM    int
	NodeID          string
	DBPath          string
	RelayEnabled    bool
	LeaseEnabled    bool
	AppRegistry     bool
	AgentRegistry   bool
	TrustIndex      bool
	MegaMMR         bool
	SkipAuth        bool
}

type LookupNode struct {
	config        LookupNodeConfig
	provider      ChainStateProvider
	store         *SqliteStore
	watchlist     *WatchlistManager
	relay         *TxPoWRelay
	lease         *LeaseCoordinator
	appRegistry   *AppRegistry
	agentRegistry *AgentRegistry
	trustIndex    *TrustIndex
	nodeID        string
	sessions      map[string]*ClientSession
	mu            sync.RWMutex
	started       bool
	stopCh        chan struct{}
}

func NewLookupNode(config LookupNodeConfig) (*LookupNode, error) {
	if config.PollIntervalMs == 0 {
		config.PollIntervalMs = 5 * time.Second
	}
	if config.ChallengeTTLMs == 0 {
		config.ChallengeTTLMs = 30 * time.Second
	}
	if config.RateLimitRPM == 0 {
		config.RateLimitRPM = 120
	}
	if config.NodeID == "" {
		b := make([]byte, 8)
		rand.Read(b)
		config.NodeID = fmt.Sprintf("node-%x", b)
	}
	if config.DBPath == "" {
		config.DBPath = ":memory:"
	}

	store, err := NewSqliteStore(config.DBPath)
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	n := &LookupNode{
		config:    config,
		provider:  config.Provider,
		store:     store,
		nodeID:    config.NodeID,
		sessions:  make(map[string]*ClientSession),
		stopCh:    make(chan struct{}),
	}

	n.watchlist = NewWatchlistManager(config.Provider, config.PollIntervalMs, store)

	if config.RelayEnabled {
		n.relay = NewTxPoWRelay(config.Provider, store)
	}

	if config.LeaseEnabled {
		n.lease = NewLeaseCoordinator(config.NodeID, store)
	}

	if config.AppRegistry {
		n.appRegistry = NewAppRegistry(store)
	}

	if config.AgentRegistry {
		n.agentRegistry = NewAgentRegistry(store)
	}

	if config.TrustIndex {
		n.trustIndex = NewTrustIndex(store)
	}

	return n, nil
}

func (n *LookupNode) Start() error {
	n.mu.Lock()
	if n.started {
		n.mu.Unlock()
		return nil
	}
	n.started = true
	n.mu.Unlock()

	if n.lease != nil {
		n.lease.Initialize()
	}

	n.watchlist.Start()

	if n.agentRegistry != nil {
		n.agentRegistry.StartExpiryLoop(60 * time.Second)
	}

	return nil
}

func (n *LookupNode) Stop() {
	n.mu.Lock()
	defer n.mu.Unlock()
	n.started = false
	n.watchlist.Stop()
	if n.agentRegistry != nil {
		n.agentRegistry.StopExpiryLoop()
	}
	n.sessions = make(map[string]*ClientSession)
	n.store.Close()
	close(n.stopCh)
}

func (n *LookupNode) HandleConnection(transport ITransport) *ClientSession {
	session := NewClientSession(transport, n)
	n.mu.Lock()
	n.sessions[session.SessionID] = session
	n.mu.Unlock()
	return session
}

func (n *LookupNode) OnSessionClosed(sessionID string) {
	n.mu.Lock()
	delete(n.sessions, sessionID)
	n.mu.Unlock()
}

func (n *LookupNode) SessionCount() int {
	n.mu.RLock()
	defer n.mu.RUnlock()
	return len(n.sessions)
}

func (n *LookupNode) IsMegaMMRMode() bool {
	return n.config.MegaMMR
}

type ClientSession struct {
	SessionID       string
	Authenticated   bool
	PublicKeyHex    string
	ConnectedAt     int64
	transport       ITransport
	node            *LookupNode
	challenge       string
	challengeExpiry int64
	rpmCount        int
	rpmWindowStart  int64
	destroyed       bool
	mu              sync.Mutex
}

func NewClientSession(transport ITransport, node *LookupNode) *ClientSession {
	challengeBytes := make([]byte, 32)
	rand.Read(challengeBytes)
	challenge := hex.EncodeToString(challengeBytes)
	expiry := time.Now().Add(node.config.ChallengeTTLMs).UnixMilli()

	s := &ClientSession{
		SessionID:       fmt.Sprintf("session-%x-%d", challengeBytes[:8], time.Now().UnixMilli()),
		ConnectedAt:     time.Now().UnixMilli(),
		transport:       transport,
		node:            node,
		challenge:       challenge,
		challengeExpiry: expiry,
	}

	s.sendMessage(LookupMessage{
		Type:    "AUTH_CHALLENGE",
		Version: ProtocolVersion,
		Payload: mustMarshal(map[string]interface{}{
			"challenge": challenge,
			"expiresAt": expiry,
		}),
	})

	transport.OnData(func(chunk []byte) {
		var msg LookupMessage
		if err := json.Unmarshal(chunk, &msg); err != nil {
			return
		}
		s.handleMessage(msg)
	})

	transport.OnClose(func() {
		s.mu.Lock()
		if s.destroyed {
			s.mu.Unlock()
			return
		}
		s.destroyed = true
		s.mu.Unlock()
		s.node.watchlist.RemoveSession(s.SessionID)
		s.node.OnSessionClosed(s.SessionID)
	})

	transport.OnError(func(err error) {})

	return s
}

func (s *ClientSession) handleMessage(msg LookupMessage) {
	if msg.Type == "HELLO" {
		s.sendMessage(LookupMessage{
			Type:    "AUTH_CHALLENGE",
			Version: ProtocolVersion,
			ID:      msg.ID,
			Payload: mustMarshal(map[string]interface{}{
				"challenge": s.challenge,
				"expiresAt": s.challengeExpiry,
			}),
		})
		return
	}

	if !s.Authenticated {
		if msg.Type == "AUTH_RESPONSE" {
			s.handleAuthResponse(msg)
		} else {
			s.sendError(msg.ID, "AUTH_REQUIRED", "Not authenticated")
		}
		return
	}

	now := time.Now().UnixMilli()
	if now-s.rpmWindowStart > 60000 {
		s.rpmCount = 0
		s.rpmWindowStart = now
	}
	s.rpmCount++
	if s.rpmCount > s.node.config.RateLimitRPM {
		s.sendError(msg.ID, "RATE_LIMITED", "Too many requests")
		return
	}

	s.dispatch(msg)
}

func (s *ClientSession) handleAuthResponse(msg LookupMessage) {
	var payload struct {
		Challenge string `json:"challenge"`
		PublicKey string `json:"publicKey"`
		Signature string `json:"signature"`
	}
	json.Unmarshal(msg.Payload, &payload)

	if s.node.config.SkipAuth {
		s.Authenticated = true
		s.PublicKeyHex = payload.PublicKey
		s.sendMessage(LookupMessage{
			Type:    "PONG",
			Version: ProtocolVersion,
			ID:      msg.ID,
			Payload: mustMarshal(map[string]interface{}{"ts": time.Now().UnixMilli(), "echo": 0}),
		})
		return
	}

	if time.Now().UnixMilli() > s.challengeExpiry {
		s.sendError(msg.ID, "AUTH_FAILED", "challenge expired")
		return
	}
	if payload.Challenge != s.challenge {
		s.sendError(msg.ID, "AUTH_FAILED", "challenge mismatch")
		return
	}

	pubKeyBytes, err := hex.DecodeString(payload.PublicKey)
	if err != nil {
		s.sendError(msg.ID, "AUTH_FAILED", "invalid public key")
		return
	}
	sigBytes, err := hex.DecodeString(payload.Signature)
	if err != nil {
		s.sendError(msg.ID, "AUTH_FAILED", "invalid signature")
		return
	}

	if !ed25519.Verify(pubKeyBytes, []byte(payload.Challenge), sigBytes) {
		s.sendError(msg.ID, "AUTH_FAILED", "bad signature")
		return
	}

	s.Authenticated = true
	s.PublicKeyHex = payload.PublicKey

	s.sendMessage(LookupMessage{
		Type:    "PONG",
		Version: ProtocolVersion,
		ID:      msg.ID,
		Payload: mustMarshal(map[string]interface{}{"ts": time.Now().UnixMilli(), "echo": 0}),
	})
}

func (s *ClientSession) dispatch(msg LookupMessage) {
	provider := s.node.provider
	store := s.node.store

	switch msg.Type {
	case "GET_COINS":
		s.handleGetCoins(msg, provider, store)
	case "GET_COIN":
		s.handleGetCoin(msg, provider, store)
	case "GET_TIP":
		s.handleGetTip(msg, provider, store)
	case "GET_TOKEN":
		s.handleGetToken(msg, provider, store)
	case "BROADCAST_TXPOW":
		s.handleBroadcastTxPoW(msg, provider)
	case "WATCH_REGISTER":
		s.handleWatchRegister(msg)
	case "WATCH_REMOVE":
		s.handleWatchRemove(msg)
	case "PING":
		var p struct{ TS int64 `json:"ts"` }
		json.Unmarshal(msg.Payload, &p)
		s.sendMessage(LookupMessage{
			Type:    "PONG",
			Version: ProtocolVersion,
			ID:      msg.ID,
			Payload: mustMarshal(map[string]interface{}{"ts": time.Now().UnixMilli(), "echo": p.TS}),
		})
	}
}

func (s *ClientSession) handleGetCoins(msg LookupMessage, provider ChainStateProvider, store *SqliteStore) {
	var p struct {
		Address  string `json:"address"`
		TokenID  string `json:"tokenId"`
		Sendable bool   `json:"sendable"`
		Relevant bool   `json:"relevant"`
	}
	json.Unmarshal(msg.Payload, &p)

	if p.Address == "" && !s.node.IsMegaMMRMode() {
		s.sendError(msg.ID, "ADDRESS_REQUIRED", "address is required for GET_COINS on a standard node")
		return
	}

	coins, err := provider.GetCoins(CoinsQuery{
		Address:  p.Address,
		TokenID:  p.TokenID,
		Sendable: p.Sendable,
		Relevant: p.Relevant,
	})
	if err != nil {
		s.sendError(msg.ID, "INTERNAL_ERROR", err.Error())
		return
	}

	s.sendMessage(LookupMessage{
		Type:    "COINS_RESPONSE",
		Version: ProtocolVersion,
		ID:      msg.ID,
		Payload: mustMarshal(map[string]interface{}{"coins": coins}),
	})
	_ = store
}

func (s *ClientSession) handleGetCoin(msg LookupMessage, provider ChainStateProvider, store *SqliteStore) {
	var p struct{ CoinID string `json:"coinId"` }
	json.Unmarshal(msg.Payload, &p)

	coin, err := provider.GetCoin(p.CoinID)
	if err != nil {
		s.sendError(msg.ID, "INTERNAL_ERROR", err.Error())
		return
	}

	s.sendMessage(LookupMessage{
		Type:    "COIN_RESPONSE",
		Version: ProtocolVersion,
		ID:      msg.ID,
		Payload: mustMarshal(map[string]interface{}{"coin": coin}),
	})
	_ = store
}

func (s *ClientSession) handleGetTip(msg LookupMessage, provider ChainStateProvider, store *SqliteStore) {
	tip, err := provider.GetTip()
	if err != nil {
		s.sendError(msg.ID, "INTERNAL_ERROR", err.Error())
		return
	}

	s.sendMessage(LookupMessage{
		Type:    "TIP_RESPONSE",
		Version: ProtocolVersion,
		ID:      msg.ID,
		Payload: mustMarshal(map[string]interface{}{
			"block": tip.Block,
			"hash":  tip.Hash,
			"time":  tip.Time,
		}),
	})
	_ = store
}

func (s *ClientSession) handleGetToken(msg LookupMessage, provider ChainStateProvider, store *SqliteStore) {
	var p struct{ TokenID string `json:"tokenId"` }
	json.Unmarshal(msg.Payload, &p)

	token, err := provider.GetToken(p.TokenID)
	if err != nil {
		s.sendError(msg.ID, "INTERNAL_ERROR", err.Error())
		return
	}

	s.sendMessage(LookupMessage{
		Type:    "TOKEN_RESPONSE",
		Version: ProtocolVersion,
		ID:      msg.ID,
		Payload: mustMarshal(map[string]interface{}{"token": token}),
	})
	_ = store
}

func (s *ClientSession) handleBroadcastTxPoW(msg LookupMessage, provider ChainStateProvider) {
	var p struct{ TxpowHex string `json:"txpowHex"` }
	json.Unmarshal(msg.Payload, &p)

	if s.node.relay != nil {
		result := s.node.relay.Process(p.TxpowHex)
		s.sendMessage(LookupMessage{
			Type:    "BROADCAST_RESPONSE",
			Version: ProtocolVersion,
			ID:      msg.ID,
			Payload: mustMarshal(result),
		})
		return
	}

	result, err := provider.BroadcastTxPoW(p.TxpowHex)
	if err != nil {
		result = &BroadcastResult{Success: false, Message: err.Error()}
	}

	s.sendMessage(LookupMessage{
		Type:    "BROADCAST_RESPONSE",
		Version: ProtocolVersion,
		ID:      msg.ID,
		Payload: mustMarshal(result),
	})
}

func (s *ClientSession) handleWatchRegister(msg LookupMessage) {
	var p struct{ Addresses []string `json:"addresses"` }
	json.Unmarshal(msg.Payload, &p)
	s.node.watchlist.Register(s.SessionID, p.Addresses, s.transport)
}

func (s *ClientSession) handleWatchRemove(msg LookupMessage) {
	var p struct{ Addresses []string `json:"addresses"` }
	json.Unmarshal(msg.Payload, &p)
	s.node.watchlist.Remove(s.SessionID, p.Addresses)
}

func (s *ClientSession) sendMessage(msg LookupMessage) {
	data, _ := json.Marshal(msg)
	s.transport.Send(data)
}

func (s *ClientSession) sendError(requestID, code, message string) {
	s.sendMessage(LookupMessage{
		Type:    "ERROR",
		Version: ProtocolVersion,
		ID:      requestID,
		Payload: mustMarshal(map[string]string{"code": code, "message": message, "requestId": requestID}),
	})
}

type WatchlistManager struct {
	provider ChainStateProvider
	interval time.Duration
	store    *SqliteStore
	watches  map[string]map[string]*subscriber
	coinCache map[string]map[string]Coin
	sessionKeys map[string]map[string]struct{}
	lastBlock int
	mu        sync.RWMutex
	ticker    *time.Ticker
	stopCh    chan struct{}
}

type subscriber struct {
	transport ITransport
}

func NewWatchlistManager(provider ChainStateProvider, interval time.Duration, store *SqliteStore) *WatchlistManager {
	return &WatchlistManager{
		provider:    provider,
		interval:    interval,
		store:       store,
		watches:     make(map[string]map[string]*subscriber),
		coinCache:   make(map[string]map[string]Coin),
		sessionKeys: make(map[string]map[string]struct{}),
		stopCh:      make(chan struct{}),
	}
}

func (w *WatchlistManager) Register(sessionID string, addresses []string, transport ITransport) {
	w.mu.Lock()
	defer w.mu.Unlock()

	if w.sessionKeys[sessionID] == nil {
		w.sessionKeys[sessionID] = make(map[string]struct{})
	}
	keys := w.sessionKeys[sessionID]

	for _, addr := range addresses {
		if w.watches[addr] == nil {
			w.watches[addr] = make(map[string]*subscriber)
		}
		w.watches[addr][sessionID] = &subscriber{transport: transport}
		keys[addr] = struct{}{}
	}
}

func (w *WatchlistManager) Remove(sessionID string, addresses []string) {
	w.mu.Lock()
	defer w.mu.Unlock()

	keys := w.sessionKeys[sessionID]
	for _, addr := range addresses {
		delete(w.watches[addr], sessionID)
		if len(w.watches[addr]) == 0 {
			delete(w.watches, addr)
			delete(w.coinCache, addr)
		}
		if keys != nil {
			delete(keys, addr)
		}
	}
}

func (w *WatchlistManager) RemoveSession(sessionID string) {
	w.mu.Lock()
	defer w.mu.Unlock()

	keys := w.sessionKeys[sessionID]
	if keys == nil {
		return
	}
	for addr := range keys {
		delete(w.watches[addr], sessionID)
		if len(w.watches[addr]) == 0 {
			delete(w.watches, addr)
			delete(w.coinCache, addr)
		}
	}
	delete(w.sessionKeys, sessionID)
}

func (w *WatchlistManager) Start() {
	w.ticker = time.NewTicker(w.interval)
	go func() {
		for {
			select {
			case <-w.ticker.C:
				w.poll()
			case <-w.stopCh:
				return
			}
		}
	}()
}

func (w *WatchlistManager) Stop() {
	if w.ticker != nil {
		w.ticker.Stop()
	}
	close(w.stopCh)
}

func (w *WatchlistManager) poll() {
	tip, err := w.provider.GetTip()
	if err != nil {
		return
	}

	w.mu.Lock()
	if tip.Block <= w.lastBlock {
		w.mu.Unlock()
		return
	}
	w.lastBlock = tip.Block

	addresses := make([]string, 0, len(w.watches))
	for addr := range w.watches {
		addresses = append(addresses, addr)
	}
	w.mu.Unlock()

	for _, addr := range addresses {
		w.checkAddress(addr, tip.Block)
	}
}

func (w *WatchlistManager) checkAddress(addr string, block int) {
	w.mu.RLock()
	subs := w.watches[addr]
	w.mu.RUnlock()

	if len(subs) == 0 {
		return
	}

	coins, err := w.provider.GetCoins(CoinsQuery{Address: addr})
	if err != nil {
		return
	}

	w.mu.Lock()
	prev := w.coinCache[addr]
	if prev == nil {
		prev = make(map[string]Coin)
	}
	next := make(map[string]Coin)
	for _, c := range coins {
		next[c.CoinID] = c
	}

	for coinID, coin := range next {
		if _, ok := prev[coinID]; !ok {
			w.pushUpdate(subs, "new", coin, block)
		}
	}
	for coinID, coin := range prev {
		if _, ok := next[coinID]; !ok {
			w.pushUpdate(subs, "spent", coin, block)
		}
	}

	w.coinCache[addr] = next
	w.mu.Unlock()
}

func (w *WatchlistManager) pushUpdate(subs map[string]*subscriber, eventType string, coin Coin, block int) {
	msg := LookupMessage{
		Type:    "COIN_UPDATE",
		Version: ProtocolVersion,
		Payload: mustMarshal(map[string]interface{}{
			"eventType": eventType,
			"coin":      coin,
			"block":     block,
		}),
	}
	data, _ := json.Marshal(msg)

	for _, sub := range subs {
		sub.transport.Send(data)
	}
}

type TxPoWRelay struct {
	provider ChainStateProvider
	store    *SqliteStore
}

func NewTxPoWRelay(provider ChainStateProvider, store *SqliteStore) *TxPoWRelay {
	return &TxPoWRelay{provider: provider, store: store}
}

func (r *TxPoWRelay) Process(txpowHex string) BroadcastResult {
	if len(txpowHex) < 200 {
		return BroadcastResult{Success: false, Message: "TxPoW too short"}
	}

	dedupKey := txpowHex[:min(64, len(txpowHex))]
	if r.store != nil && r.store.RelayHasSeen(dedupKey) {
		return BroadcastResult{Success: false, Message: "duplicate TxPoW"}
	}

	if r.store != nil {
		r.store.RelayMarkSeen(dedupKey)
	}

	result, err := r.provider.BroadcastTxPoW(txpowHex)
	if err != nil {
		return BroadcastResult{Success: false, Message: err.Error()}
	}
	return *result
}

type LeaseCoordinator struct {
	nodeID string
	store  *SqliteStore
}

func NewLeaseCoordinator(nodeID string, store *SqliteStore) *LeaseCoordinator {
	return &LeaseCoordinator{nodeID: nodeID, store: store}
}

func (l *LeaseCoordinator) Initialize() {
	log.Printf("[lookup-node] Lease coordinator initialized for node %s", l.nodeID)
}

type AppRegistry struct {
	store *SqliteStore
}

func NewAppRegistry(store *SqliteStore) *AppRegistry {
	return &AppRegistry{store: store}
}

type AgentRegistry struct {
	store      *SqliteStore
	stopExpiry chan struct{}
}

func NewAgentRegistry(store *SqliteStore) *AgentRegistry {
	return &AgentRegistry{store: store, stopExpiry: make(chan struct{})}
}

func (a *AgentRegistry) StartExpiryLoop(interval time.Duration) {
	go func() {
		ticker := time.NewTicker(interval)
		defer ticker.Stop()
		for {
			select {
			case <-ticker.C:
			case <-a.stopExpiry:
				return
			}
		}
	}()
}

func (a *AgentRegistry) StopExpiryLoop() {
	close(a.stopExpiry)
}

type TrustIndex struct {
	store *SqliteStore
}

func NewTrustIndex(store *SqliteStore) *TrustIndex {
	return &TrustIndex{store: store}
}

type SqliteStore struct {
	db *sql.DB
	mu sync.Mutex
}

func NewSqliteStore(dbPath string) (*SqliteStore, error) {
	db, err := sql.Open("sqlite3", dbPath)
	if err != nil {
		return nil, err
	}

	s := &SqliteStore{db: db}
	if err := s.init(); err != nil {
		return nil, err
	}
	return s, nil
}

func (s *SqliteStore) init() error {
	queries := []string{
		`PRAGMA journal_mode = WAL`,
		`CREATE TABLE IF NOT EXISTS relay_dedup (tx_key TEXT PRIMARY KEY, seen_at INTEGER NOT NULL)`,
		`CREATE TABLE IF NOT EXISTS result_cache (cache_key TEXT PRIMARY KEY, data TEXT NOT NULL, expires_at INTEGER NOT NULL)`,
		`CREATE TABLE IF NOT EXISTS kv_store (kv_key TEXT PRIMARY KEY, kv_value TEXT NOT NULL)`,
		`CREATE TABLE IF NOT EXISTS watchlist (session_id TEXT NOT NULL, address TEXT NOT NULL, PRIMARY KEY (session_id, address))`,
	}
	for _, q := range queries {
		if _, err := s.db.Exec(q); err != nil {
			return err
		}
	}
	return nil
}

func (s *SqliteStore) RelayHasSeen(key string) bool {
	var exists bool
	s.db.QueryRow("SELECT 1 FROM relay_dedup WHERE tx_key = ?", key).Scan(&exists)
	return exists
}

func (s *SqliteStore) RelayMarkSeen(key string) {
	s.db.Exec("INSERT OR IGNORE INTO relay_dedup (tx_key, seen_at) VALUES (?, ?)", key, time.Now().UnixMilli())
}

func (s *SqliteStore) CacheGet(key string) (string, bool) {
	var data string
	err := s.db.QueryRow("SELECT data FROM result_cache WHERE cache_key = ? AND expires_at > ?", key, time.Now().UnixMilli()).Scan(&data)
	if err != nil {
		return "", false
	}
	return data, true
}

func (s *SqliteStore) CacheSet(key, data string, ttlMs int64) {
	s.db.Exec("INSERT OR REPLACE INTO result_cache (cache_key, data, expires_at) VALUES (?, ?, ?)", key, data, time.Now().UnixMilli()+ttlMs)
}

func (s *SqliteStore) KVGet(key string) (string, bool) {
	var value string
	err := s.db.QueryRow("SELECT kv_value FROM kv_store WHERE kv_key = ?", key).Scan(&value)
	if err != nil {
		return "", false
	}
	return value, true
}

func (s *SqliteStore) KVSet(key, value string) {
	s.db.Exec("INSERT OR REPLACE INTO kv_store (kv_key, kv_value) VALUES (?, ?)", key, value)
}

func (s *SqliteStore) Close() {
	s.db.Close()
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
	_ = ed25519.PrivateKey{}
}
