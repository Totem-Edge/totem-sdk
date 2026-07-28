package seserver

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"golang.org/x/crypto/sha3"

	_ "github.com/lib/pq"
)

type SeServerConfig struct {
	SeSeed          []byte
	DatabaseURL     string
	Port            int
	ReclaimTimelock int
	BetaMode        bool
	OnSign          func(chainID, eventType, projectID string)
}

type SeServer struct {
	config SeServerConfig
	db     *sql.DB
	server *http.Server
}

func NewSeServer(config SeServerConfig) (*SeServer, error) {
	db, err := sql.Open("postgres", config.DatabaseURL)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to database: %w", err)
	}

	if err := migrateStatechainTables(db); err != nil {
		return nil, fmt.Errorf("failed to migrate tables: %w", err)
	}

	if config.ReclaimTimelock == 0 {
		config.ReclaimTimelock = 256
	}
	if config.Port == 0 {
		config.Port = 4000
	}

	s := &SeServer{
		config: config,
		db:     db,
	}

	mux := http.NewServeMux()
	s.registerRoutes(mux)

	s.server = &http.Server{
		Addr:    fmt.Sprintf("0.0.0.0:%d", config.Port),
		Handler: mux,
	}

	return s, nil
}

func (s *SeServer) Listen() error {
	sePkd := getPublicKeyHex(s.config.SeSeed)
	log.Printf("[se-server] Listening on port %d", s.config.Port)
	log.Printf("[se-server] SE public key: %s", sePkd)
	return s.server.ListenAndServe()
}

func (s *SeServer) Close() error {
	return s.db.Close()
}

func (s *SeServer) registerRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/statechain/se-public-key", s.handleSEPublicKey)
	mux.HandleFunc("/statechain/create", s.handleCreate)
	mux.HandleFunc("/statechain/", s.handleChainRoutes)
}

func (s *SeServer) betaHeaders(w http.ResponseWriter) {
	if s.config.BetaMode {
		w.Header().Set("X-Beta", "true")
		w.Header().Set("X-Beta-Warning", "BETA API. Breaking changes may occur without notice.")
		w.Header().Set("X-SE-SLA", "99.5%")
	}
}

func (s *SeServer) handleSEPublicKey(w http.ResponseWriter, r *http.Request) {
	s.betaHeaders(w)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"sePublicKey":    getPublicKeyHex(s.config.SeSeed),
		"reclaimTimelock": s.config.ReclaimTimelock,
		"sla":            "99.5%",
	})
}

func (s *SeServer) handleCreate(w http.ResponseWriter, r *http.Request) {
	s.betaHeaders(w)
	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	var body struct {
		CoinID              string `json:"coinId"`
		OwnerPublicKeyDigest string `json:"ownerPublicKeyDigest"`
		OwnerPartyID        string `json:"ownerPartyId"`
		ReclaimTxHex        string `json:"reclaimTxHex"`
		TokenID             string `json:"tokenId"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, `{"error":"invalid body"}`, http.StatusBadRequest)
		return
	}
	if body.TokenID == "" {
		body.TokenID = "0x00"
	}

	sePkd := getPublicKeyHex(s.config.SeSeed)
	statechainScript := buildStatechainScript(sePkd, s.config.ReclaimTimelock)
	lockingAddress := scriptAddress(statechainScript)

	chainIDBytes := make([]byte, 16)
	rand.Read(chainIDBytes)
	chainID := "sc_" + hex.EncodeToString(chainIDBytes)

	encReclaim, err := encryptReclaimTx(s.config.SeSeed, body.ReclaimTxHex)
	if err != nil {
		http.Error(w, `{"error":"encryption failed"}`, http.StatusInternalServerError)
		return
	}

	rec := &StatechainRecord{
		ChainID:             chainID,
		ProjectID:           "default",
		CoinID:              body.CoinID,
		TokenID:             body.TokenID,
		StatechainScript:    statechainScript,
		LockingAddress:      lockingAddress,
		SEPublicKey:         sePkd,
		CurrentOwnerPartyID: body.OwnerPartyID,
		CurrentOwnerPKD:     body.OwnerPublicKeyDigest,
		ReclaimTxHexEnc:     encReclaim,
	}

	if err := insertStatechainRecord(s.db, rec); err != nil {
		http.Error(w, fmt.Sprintf(`{"error":"%s"}`, err), http.StatusInternalServerError)
		return
	}
	logSignEvent(s.db, chainID, "create")
	if s.config.OnSign != nil {
		s.config.OnSign(chainID, "create", "default")
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"chainId":          chainID,
		"statechainScript": statechainScript,
		"lockingAddress":   lockingAddress,
		"sePublicKey":      sePkd,
		"reclaimTxHex":     body.ReclaimTxHex,
		"reclaimTimelock":  s.config.ReclaimTimelock,
		"tokenId":          body.TokenID,
	})
}

func (s *SeServer) handleChainRoutes(w http.ResponseWriter, r *http.Request) {
	s.betaHeaders(w)

	path := strings.TrimPrefix(r.URL.Path, "/statechain/")
	parts := strings.SplitN(path, "/", 2)
	if len(parts) < 1 {
		http.Error(w, `{"error":"not found"}`, http.StatusNotFound)
		return
	}

	chainID := parts[0]
	subPath := ""
	if len(parts) > 1 {
		subPath = parts[1]
	}

	switch {
	case subPath == "challenge" && r.Method == http.MethodGet:
		s.handleChallenge(w, r, chainID)
	case subPath == "blind-sign" && r.Method == http.MethodPost:
		s.handleBlindSign(w, r, chainID)
	case subPath == "revoke-key" && r.Method == http.MethodPost:
		s.handleRevokeKey(w, r, chainID)
	case subPath == "claim" && r.Method == http.MethodPost:
		s.handleClaim(w, r, chainID)
	case subPath == "reclaim-tx" && r.Method == http.MethodGet:
		s.handleReclaimTx(w, r, chainID)
	case subPath == "" && r.Method == http.MethodGet:
		s.handleGetChain(w, r, chainID)
	default:
		http.Error(w, `{"error":"not found"}`, http.StatusNotFound)
	}
}

func (s *SeServer) handleChallenge(w http.ResponseWriter, r *http.Request, chainID string) {
	chain, err := getStatechainRecord(s.db, chainID)
	if err != nil || chain == nil {
		http.Error(w, `{"error":"statechain not found"}`, http.StatusNotFound)
		return
	}
	if chain.Status == "claimed" {
		http.Error(w, `{"error":"statechain already claimed"}`, http.StatusGone)
		return
	}

	nonce, err := issueNonce(s.db, chainID)
	if err != nil {
		http.Error(w, `{"error":"failed to issue nonce"}`, http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"nonce":             nonce,
		"expiresInSeconds":  300,
	})
}

func (s *SeServer) handleBlindSign(w http.ResponseWriter, r *http.Request, chainID string) {
	var body struct {
		BlindedCommitment string `json:"blindedCommitment"`
		Nonce             string `json:"nonce"`
		OwnerSignature    string `json:"ownerSignature"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, `{"error":"invalid body"}`, http.StatusBadRequest)
		return
	}

	chain, err := getStatechainRecord(s.db, chainID)
	if err != nil || chain == nil {
		http.Error(w, `{"error":"statechain not found"}`, http.StatusNotFound)
		return
	}
	if chain.Status != "active" {
		http.Error(w, fmt.Sprintf(`{"error":"statechain not active (%s)"}`, chain.Status), http.StatusConflict)
		return
	}

	nonceChainID, err := consumeNonce(s.db, body.Nonce)
	if err != nil || nonceChainID != chainID {
		http.Error(w, `{"error":"invalid or expired nonce"}`, http.StatusUnauthorized)
		return
	}

	if !s.verifyOwnerSig(chain.CurrentOwnerPKD, body.Nonce, body.OwnerSignature) {
		http.Error(w, `{"error":"ownership verification failed"}`, http.StatusForbidden)
		return
	}

	revoked, _ := isRevoked(s.db, chainID, chain.CurrentOwnerPartyID)
	if revoked {
		http.Error(w, `{"error":"current owner key has been revoked"}`, http.StatusForbidden)
		return
	}

	commitmentBytes, err := hex.DecodeString(strings.TrimPrefix(body.BlindedCommitment, "0x"))
	if err != nil {
		http.Error(w, `{"error":"blindedCommitment must be valid hex"}`, http.StatusBadRequest)
		return
	}

	seSig, err := seSign(s.config.SeSeed, commitmentBytes)
	if err != nil {
		http.Error(w, `{"error":"signing failed"}`, http.StatusInternalServerError)
		return
	}

	logSignEvent(s.db, chainID, "blind_sign")
	if s.config.OnSign != nil {
		s.config.OnSign(chainID, "blind_sign", "default")
	}

	json.NewEncoder(w).Encode(map[string]string{
		"blindSignature": hex.EncodeToString(seSig),
	})
}

func (s *SeServer) handleRevokeKey(w http.ResponseWriter, r *http.Request, chainID string) {
	var body struct {
		PreviousOwnerPartyID string `json:"previousOwnerPartyId"`
		PreviousOwnerPKD     string `json:"previousOwnerPkd"`
		NewOwnerPartyID      string `json:"newOwnerPartyId"`
		NewOwnerPKD          string `json:"newOwnerPkd"`
		NewReclaimTxHex      string `json:"newReclaimTxHex"`
		OwnerSignature       string `json:"ownerSignature"`
		Nonce                string `json:"nonce"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, `{"error":"invalid body"}`, http.StatusBadRequest)
		return
	}

	chain, err := getStatechainRecord(s.db, chainID)
	if err != nil || chain == nil {
		http.Error(w, `{"error":"statechain not found"}`, http.StatusNotFound)
		return
	}
	if chain.Status != "active" {
		http.Error(w, fmt.Sprintf(`{"error":"statechain not active (%s)"}`, chain.Status), http.StatusConflict)
		return
	}

	nonceChainID, err := consumeNonce(s.db, body.Nonce)
	if err != nil || nonceChainID != chainID {
		http.Error(w, `{"error":"invalid or expired nonce"}`, http.StatusUnauthorized)
		return
	}

	if !s.verifyOwnerSig(body.PreviousOwnerPKD, body.Nonce, body.OwnerSignature) {
		http.Error(w, `{"error":"previous owner signature verification failed"}`, http.StatusForbidden)
		return
	}
	if body.PreviousOwnerPKD != chain.CurrentOwnerPKD {
		http.Error(w, `{"error":"previousOwnerPkd does not match current chain owner"}`, http.StatusBadRequest)
		return
	}

	insertRevocation(s.db, chainID, body.PreviousOwnerPartyID, body.PreviousOwnerPKD)
	encReclaim, _ := encryptReclaimTx(s.config.SeSeed, body.NewReclaimTxHex)
	updateStatechainOwner(s.db, chainID, body.NewOwnerPartyID, body.NewOwnerPKD, encReclaim)
	logSignEvent(s.db, chainID, "revoke_key")

	json.NewEncoder(w).Encode(map[string]interface{}{
		"ok":            true,
		"transferCount": chain.TransferCount + 1,
	})
}

func (s *SeServer) handleClaim(w http.ResponseWriter, r *http.Request, chainID string) {
	var body struct {
		ClaimAddress   string `json:"claimAddress"`
		ClaimTxHex     string `json:"claimTxHex"`
		OwnerSignature string `json:"ownerSignature"`
		Nonce          string `json:"nonce"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, `{"error":"invalid body"}`, http.StatusBadRequest)
		return
	}

	chain, err := getStatechainRecord(s.db, chainID)
	if err != nil || chain == nil {
		http.Error(w, `{"error":"statechain not found"}`, http.StatusNotFound)
		return
	}
	if chain.Status != "active" {
		http.Error(w, fmt.Sprintf(`{"error":"statechain not active (%s)"}`, chain.Status), http.StatusConflict)
		return
	}

	nonceChainID, err := consumeNonce(s.db, body.Nonce)
	if err != nil || nonceChainID != chainID {
		http.Error(w, `{"error":"invalid or expired nonce"}`, http.StatusUnauthorized)
		return
	}

	if !s.verifyOwnerSig(chain.CurrentOwnerPKD, body.Nonce, body.OwnerSignature) {
		http.Error(w, `{"error":"ownership verification failed"}`, http.StatusForbidden)
		return
	}

	h := sha3.New256()
	h.Write([]byte(body.ClaimTxHex))
	claimDigest := h.Sum(nil)

	seClaimSig, _ := seSign(s.config.SeSeed, claimDigest)
	updateStatechainStatus(s.db, chainID, "claimed")
	logSignEvent(s.db, chainID, "claim")
	if s.config.OnSign != nil {
		s.config.OnSign(chainID, "claim", "default")
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"ok":               true,
		"chainId":          chainID,
		"claimAddress":     body.ClaimAddress,
		"claimTxHex":       body.ClaimTxHex,
		"seClaimSignature": hex.EncodeToString(seClaimSig),
	})
}

func (s *SeServer) handleReclaimTx(w http.ResponseWriter, r *http.Request, chainID string) {
	nonce := r.URL.Query().Get("nonce")
	ownerSignature := r.URL.Query().Get("ownerSignature")
	if nonce == "" || ownerSignature == "" {
		http.Error(w, `{"error":"provide nonce and ownerSignature as query params"}`, http.StatusBadRequest)
		return
	}

	chain, err := getStatechainRecord(s.db, chainID)
	if err != nil || chain == nil {
		http.Error(w, `{"error":"statechain not found"}`, http.StatusNotFound)
		return
	}

	nonceChainID, err := consumeNonce(s.db, nonce)
	if err != nil || nonceChainID != chainID {
		http.Error(w, `{"error":"invalid or expired nonce"}`, http.StatusUnauthorized)
		return
	}

	if !s.verifyOwnerSig(chain.CurrentOwnerPKD, nonce, ownerSignature) {
		http.Error(w, `{"error":"ownership verification failed"}`, http.StatusForbidden)
		return
	}

	reclaimTx, err := decryptReclaimTx(s.config.SeSeed, chain.ReclaimTxHexEnc)
	if err != nil {
		http.Error(w, `{"error":"failed to decrypt reclaim tx"}`, http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"chainId":         chainID,
		"reclaimTxHex":    reclaimTx,
		"reclaimTimelock": s.config.ReclaimTimelock,
		"warning":         "Broadcast ONLY after the timelock has elapsed and the SE is unresponsive.",
	})
}

func (s *SeServer) handleGetChain(w http.ResponseWriter, r *http.Request, chainID string) {
	chain, err := getStatechainRecord(s.db, chainID)
	if err != nil || chain == nil {
		http.Error(w, `{"error":"statechain not found"}`, http.StatusNotFound)
		return
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"chainId":              chain.ChainID,
		"coinId":               chain.CoinID,
		"tokenId":              chain.TokenID,
		"currentOwnerPartyId":  chain.CurrentOwnerPartyID,
		"transferCount":        chain.TransferCount,
		"status":               chain.Status,
		"lockingAddress":       chain.LockingAddress,
		"sePublicKey":         chain.SEPublicKey,
		"createdAt":            chain.CreatedAt,
	})
}

func (s *SeServer) verifyOwnerSig(ownerPKD, nonce, ownerSig string) bool {
	h := sha3.New256()
	h.Write([]byte(nonce))
	msg := h.Sum(nil)

	sigBytes, err := hex.DecodeString(strings.TrimPrefix(ownerSig, "0x"))
	if err != nil {
		return false
	}
	pkdBytes, err := hex.DecodeString(strings.TrimPrefix(ownerPKD, "0x"))
	if err != nil {
		return false
	}

	return wotsVerifyDigest(sigBytes, msg, pkdBytes)
}

type TimelockMonitor struct {
	db       *sql.DB
	interval time.Duration
	onAlert  func(chain StatechainRecord, message string)
	stopCh   chan struct{}
}

func NewTimelockMonitor(db *sql.DB, interval time.Duration, onAlert func(StatechainRecord, string)) *TimelockMonitor {
	if interval == 0 {
		interval = 15 * time.Minute
	}
	return &TimelockMonitor{
		db:       db,
		interval: interval,
		onAlert:  onAlert,
		stopCh:   make(chan struct{}),
	}
}

func (m *TimelockMonitor) Start() {
	go func() {
		ticker := time.NewTicker(m.interval)
		defer ticker.Stop()

		m.scan()

		for {
			select {
			case <-ticker.C:
				m.scan()
			case <-m.stopCh:
				return
			}
		}
	}()
	log.Printf("[se-server] Timelock monitor running every %.0f minutes", m.interval.Minutes())
}

func (m *TimelockMonitor) Stop() {
	close(m.stopCh)
}

func (m *TimelockMonitor) scan() {
	chains, err := getApproachingTimelockChains(m.db)
	if err != nil {
		log.Printf("[se-server] Timelock monitor error: %v", err)
		return
	}

	for _, chain := range chains {
		message := fmt.Sprintf(
			"[se-server] Statechain %s (project: %s) has been in disputed status since %s — owner may reclaim unilaterally after 256-block timelock.",
			chain.ChainID, chain.ProjectID, chain.UpdatedAt.Format(time.RFC3339),
		)
		log.Println(message)
		if m.onAlert != nil {
			m.onAlert(chain, message)
		}
	}
}
