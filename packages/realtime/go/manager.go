package realtime

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"math"
	"net/http"
	"sync"
	"time"

	"golang.org/x/crypto/sha3"
)

type PortfolioStreamConfig struct {
	BaseURL            string
	ProjectID          string
	Backend            PortfolioBackend
	ReconnectDelays    []time.Duration
	HTTPPollInterval   time.Duration
	TokenRefreshBuffer time.Duration
	MaxCacheAge        time.Duration
}

type PortfolioStreamManager struct {
	config             PortfolioStreamConfig
	cache              *PortfolioCache
	listeners          map[PortfolioStreamListener]struct{}
	mu                 sync.RWMutex
	connectionState    ConnectionState
	lastError          string
	subscribedAddresses []string
	isStreaming        bool
	wsConn             *websocketConn
	wsToken            string
	wsTokenExpiry      int64
	reconnectAttempts  int
	httpPollTicker     *time.Ticker
	httpPollStop       chan struct{}
	backendUnsubscribe func()
	seenEventIDs       map[string]struct{}
	lastForceRefreshAt int64
	ctx                context.Context
	cancel             context.CancelFunc
}

type websocketConn struct {
	conn interface {
		ReadMessage() (int, []byte, error)
		WriteMessage(int, []byte) error
		Close() error
	}
}

func NewPortfolioStreamManager(config PortfolioStreamConfig) *PortfolioStreamManager {
	if len(config.ReconnectDelays) == 0 {
		config.ReconnectDelays = []time.Duration{1, 2, 4, 8, 16, 30}
		for i := range config.ReconnectDelays {
			config.ReconnectDelays[i] *= time.Second
		}
	}
	if config.HTTPPollInterval == 0 {
		config.HTTPPollInterval = 10 * time.Second
	}
	if config.TokenRefreshBuffer == 0 {
		config.TokenRefreshBuffer = 5 * time.Minute
	}
	if config.MaxCacheAge == 0 {
		config.MaxCacheAge = 24 * time.Hour
	}

	ctx, cancel := context.WithCancel(context.Background())
	return &PortfolioStreamManager{
		config:        config,
		cache:         NewPortfolioCache(config.MaxCacheAge),
		listeners:     make(map[PortfolioStreamListener]struct{}),
		seenEventIDs:  make(map[string]struct{}),
		ctx:           ctx,
		cancel:        cancel,
	}
}

func (m *PortfolioStreamManager) AddListener(l PortfolioStreamListener) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.listeners[l] = struct{}{}
}

func (m *PortfolioStreamManager) RemoveListener(l PortfolioStreamListener) {
	m.mu.Lock()
	defer m.mu.Unlock()
	delete(m.listeners, l)
}

func (m *PortfolioStreamManager) GetConnectionState() ConnectionState {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.connectionState
}

func (m *PortfolioStreamManager) GetCachedPortfolio(address string) ([]PortfolioEntry, bool) {
	return m.cache.Get(address)
}

func (m *PortfolioStreamManager) Start(addresses []string) error {
	m.mu.Lock()
	m.subscribedAddresses = addresses
	m.isStreaming = true
	m.mu.Unlock()

	log.Printf("[PortfolioStream] Starting for %d addresses", len(addresses))

	if m.config.Backend != nil {
		return m.startBackend(addresses)
	}

	return m.connectWebSocket()
}

func (m *PortfolioStreamManager) startBackend(addresses []string) error {
	backend := m.config.Backend
	if backend.SupportsPush() {
		m.setConnectionState(StateConnecting, "")
		unsub, err := backend.Subscribe(addresses, func(address string, entries []PortfolioEntry) {
			m.handleBackendUpdate(address, entries, "websocket")
		})
		if err != nil {
			log.Printf("[PortfolioStream] Backend push setup failed, falling back to polling: %v", err)
			m.startHTTPFallback()
			return nil
		}
		m.backendUnsubscribe = unsub

		for _, addr := range addresses {
			entries, err := backend.GetPortfolio(addr)
			if err != nil {
				log.Printf("[PortfolioStream] Backend snapshot failed for %s: %v", addr, err)
				continue
			}
			m.handleBackendUpdate(addr, entries, "websocket")
		}
		m.setConnectionState(StateConnected, "")
	} else {
		m.startHTTPFallback()
	}
	return nil
}

func (m *PortfolioStreamManager) Stop() {
	m.mu.Lock()
	defer m.mu.Unlock()

	log.Println("[PortfolioStream] Stopping")
	m.isStreaming = false
	m.stopHTTPFallback()
	m.disconnectWebSocket()
	if m.backendUnsubscribe != nil {
		m.backendUnsubscribe()
		m.backendUnsubscribe = nil
	}
	m.subscribedAddresses = nil
	m.setConnectionState(StateDisconnected, "")
}

func (m *PortfolioStreamManager) Dispose() {
	m.Stop()
	m.cancel()
}

func (m *PortfolioStreamManager) connectWebSocket() error {
	m.setConnectionState(StateConnecting, "")

	wsURL := m.config.BaseURL
	if wsURL == "" {
		return fmt.Errorf("baseUrl is required for WebSocket connection")
	}

	// In a real implementation, this would use gorilla/websocket or nhooyr.io/websocket
	// For now, we implement the HTTP fallback path
	log.Println("[PortfolioStream] WebSocket not available in this build, using HTTP fallback")
	m.startHTTPFallback()
	return nil
}

func (m *PortfolioStreamManager) disconnectWebSocket() {
	if m.wsConn != nil {
		m.wsConn.conn.Close()
		m.wsConn = nil
	}
}

func (m *PortfolioStreamManager) startHTTPFallback() {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.httpPollTicker != nil {
		return
	}

	log.Println("[PortfolioStream] Starting HTTP fallback polling")
	m.setConnectionState(StateFallback, "")

	m.pollPortfolios()

	m.httpPollTicker = time.NewTicker(m.config.HTTPPollInterval)
	m.httpPollStop = make(chan struct{})

	go func() {
		for {
			select {
			case <-m.httpPollTicker.C:
				m.pollPortfolios()
			case <-m.httpPollStop:
				return
			case <-m.ctx.Done():
				return
			}
		}
	}()
}

func (m *PortfolioStreamManager) stopHTTPFallback() {
	if m.httpPollTicker != nil {
		m.httpPollTicker.Stop()
		m.httpPollTicker = nil
	}
	if m.httpPollStop != nil {
		close(m.httpPollStop)
		m.httpPollStop = nil
	}
}

func (m *PortfolioStreamManager) pollPortfolios() {
	m.mu.RLock()
	addresses := make([]string, len(m.subscribedAddresses))
	copy(addresses, m.subscribedAddresses)
	m.mu.RUnlock()

	if len(addresses) == 0 {
		return
	}

	backend := m.config.Backend
	if backend != nil {
		for _, addr := range addresses {
			entries, err := backend.GetPortfolio(addr)
			if err != nil {
				log.Printf("[PortfolioStream] Backend poll failed for %s: %v", addr, err)
				continue
			}
			m.handleBackendUpdate(addr, entries, "http")
		}
		return
	}

	// Default: HTTP GET to Axia API
	client := &http.Client{Timeout: 10 * time.Second}
	for _, addr := range addresses {
		url := fmt.Sprintf("%s/v1/%s/portfolio/%s", m.config.BaseURL, m.config.ProjectID, addr)
		req, err := http.NewRequestWithContext(m.ctx, "GET", url, nil)
		if err != nil {
			continue
		}
		req.Header.Set("x-api-key", m.config.ProjectID)

		resp, err := client.Do(req)
		if err != nil {
			log.Printf("[PortfolioStream] HTTP poll failed for %s: %v", addr, err)
			continue
		}

		var data struct {
			Entries []json.RawMessage `json:"entries"`
		}
		json.NewDecoder(resp.Body).Decode(&data)
		resp.Body.Close()

		var entries []PortfolioEntry
		for _, raw := range data.Entries {
			var entry PortfolioEntry
			if err := json.Unmarshal(raw, &entry); err == nil {
				entries = append(entries, entry)
			}
		}
		m.handleBackendUpdate(addr, entries, "http")
	}
}

func (m *PortfolioStreamManager) handleBackendUpdate(address string, entries []PortfolioEntry, source string) {
	m.cache.Set(address, entries)
	m.emitPortfolioUpdate(address, entries, fmt.Sprintf("backend-%s-%d-%s", source, time.Now().UnixMilli(), address[:min(8, len(address))]))
}

func (m *PortfolioStreamManager) emitPortfolioUpdate(address string, entries []PortfolioEntry, eventID string) {
	event := PortfolioUpdateEvent{
		Version:   "3.0",
		Timestamp: time.Now().UnixMilli(),
		EventID:   eventID,
		Type:      "portfolio_update",
		Address:   address,
		Entries:   entries,
	}

	m.mu.RLock()
	defer m.mu.RUnlock()

	for l := range m.listeners {
		l.OnPortfolioUpdate(event)
	}
}

func (m *PortfolioStreamManager) setConnectionState(state ConnectionState, err string) {
	m.mu.Lock()
	prev := m.connectionState
	m.connectionState = state
	m.lastError = err
	listeners := make([]PortfolioStreamListener, 0, len(m.listeners))
	for l := range m.listeners {
		listeners = append(listeners, l)
	}
	m.mu.Unlock()

	if prev != state {
		log.Printf("[PortfolioStream] Connection state: %s", state)
		for _, l := range listeners {
			l.OnConnectionStateChange(state, err)
		}
	}
}

func (m *PortfolioStreamManager) scheduleReconnect() {
	m.mu.Lock()
	delays := m.config.ReconnectDelays
	attempt := m.reconnectAttempts
	m.reconnectAttempts++
	m.mu.Unlock()

	delay := delays[min(attempt, len(delays)-1)]
	log.Printf("[PortfolioStream] Scheduling reconnect in %v (attempt %d)", delay, attempt+1)
	m.setConnectionState(StateConnecting, "")

	time.AfterFunc(delay, func() {
		select {
		case <-m.ctx.Done():
			return
		default:
		}

		m.mu.RLock()
		attempts := m.reconnectAttempts
		m.mu.RUnlock()

		if err := m.connectWebSocket(); err != nil {
			log.Printf("[PortfolioStream] Reconnect failed: %v", err)
			if attempts >= len(delays) {
				log.Println("[PortfolioStream] Max reconnect attempts reached, falling back to HTTP")
				m.startHTTPFallback()
			} else {
				m.scheduleReconnect()
			}
		}
	})
}

func BuildPaymentRequest(amount, tokenID, expiryBlock, description string) (*PaymentRequest, error) {
	preimageBytes := make([]byte, 32)
	// In production, use crypto/rand
	preimage := fmt.Sprintf("0x%x", preimageBytes)

	hash := sha3.New256()
	hash.Write(preimageBytes)
	hashlock := fmt.Sprintf("0x%x", hash.Sum(nil))

	return &PaymentRequest{
		Hashlock:    hashlock,
		Preimage:    preimage,
		Amount:      amount,
		TokenID:     tokenID,
		ExpiryBlock: expiryBlock,
		Description: description,
	}, nil
}

type PaymentRequest struct {
	Hashlock    string `json:"hashlock"`
	Preimage    string `json:"preimage,omitempty"`
	Amount      string `json:"amount"`
	TokenID     string `json:"tokenId"`
	ExpiryBlock string `json:"expiryBlock"`
	Description string `json:"description,omitempty"`
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func init() {
	_ = math.MaxInt64
}
