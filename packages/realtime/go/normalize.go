package realtime

import (
	"encoding/json"
	"strconv"
	"strings"
)

type PortfolioEntry struct {
	Kind        string `json:"kind"`
	TokenID     string `json:"tokenid"`
	Confirmed   string `json:"confirmed"`
	Unconfirmed string `json:"unconfirmed"`
	Sendable    string `json:"sendable"`
	Total       string `json:"total"`
	Decimals    int    `json:"decimals"`
	Name        string `json:"name"`
	Ticker      string `json:"ticker"`
	Artimage    string `json:"artimage,omitempty"`
	Webvalidate string `json:"webvalidate,omitempty"`
	Address     string `json:"address"`
	Coins       int    `json:"coins,omitempty"`
	Icon        string `json:"icon,omitempty"`
	URL         string `json:"url,omitempty"`
	Owner       string `json:"owner,omitempty"`
	Description string `json:"description,omitempty"`
}

type PortfolioUpdateEvent struct {
	Version   string           `json:"version"`
	Timestamp int64            `json:"timestamp"`
	EventID   string           `json:"eventId"`
	Type      string           `json:"type"`
	Address   string           `json:"address"`
	Entries   []PortfolioEntry `json:"entries"`
}

type TxConfirmationEvent struct {
	Version       string `json:"version"`
	Timestamp     int64  `json:"timestamp"`
	EventID       string `json:"eventId"`
	Type          string `json:"type"`
	TxID          string `json:"txid"`
	Address       string `json:"address"`
	Confirmations int    `json:"confirmations"`
	Status        string `json:"status"`
	Block         int    `json:"block"`
	Amount        string `json:"amount"`
	TokenID       string `json:"tokenid"`
}

type ConnectionState string

const (
	StateDisconnected ConnectionState = "disconnected"
	StateConnecting   ConnectionState = "connecting"
	StateConnected    ConnectionState = "connected"
	StateError        ConnectionState = "error"
	StateFallback     ConnectionState = "fallback"
)

type PortfolioStreamListener interface {
	OnPortfolioUpdate(event PortfolioUpdateEvent)
	OnTxConfirmation(event TxConfirmationEvent)
	OnConnectionStateChange(state ConnectionState, err string)
}

type PortfolioBackend interface {
	SupportsPush() bool
	GetPortfolio(address string) ([]PortfolioEntry, error)
	Subscribe(addresses []string, onUpdate func(address string, entries []PortfolioEntry)) (func(), error)
}

type RawBalanceEntry struct {
	TokenID            string      `json:"tokenid,omitempty"`
	TokenIDAlt         string      `json:"token_id,omitempty"`
	Confirmed          string      `json:"confirmed,omitempty"`
	ConfirmedBalance   string      `json:"confirmed_balance,omitempty"`
	Unconfirmed        string      `json:"unconfirmed,omitempty"`
	UnconfirmedBalance string      `json:"unconfirmed_balance,omitempty"`
	Sendable           string      `json:"sendable,omitempty"`
	Total              string      `json:"total,omitempty"`
	Balance            string      `json:"balance,omitempty"`
	Decimals           interface{} `json:"decimals,omitempty"`
	Name               string      `json:"name,omitempty"`
	Ticker             string      `json:"ticker,omitempty"`
	Artimage           string      `json:"artimage,omitempty"`
	Webvalidate        string      `json:"webvalidate,omitempty"`
	Address            string      `json:"address,omitempty"`
	Token              interface{} `json:"token,omitempty"`
}

func ClassifyKind(tokenID string, decimals int, total, artimage string) string {
	if tokenID == "0x00" {
		return "native"
	}
	if artimage != "" && decimals == 0 && total == "1" {
		return "nft"
	}
	return "token"
}

func ToPortfolioEntry(raw RawBalanceEntry, address string) PortfolioEntry {
	tokenID := raw.TokenID
	if tokenID == "" {
		tokenID = raw.TokenIDAlt
	}
	if tokenID == "" {
		tokenID = "0x00"
	}

	confirmed := raw.Confirmed
	if confirmed == "" {
		confirmed = raw.ConfirmedBalance
	}
	if confirmed == "" {
		confirmed = raw.Balance
	}
	if confirmed == "" {
		confirmed = "0"
	}

	unconfirmed := raw.Unconfirmed
	if unconfirmed == "" {
		unconfirmed = raw.UnconfirmedBalance
	}
	if unconfirmed == "" {
		unconfirmed = "0"
	}

	sendable := raw.Sendable
	if sendable == "" {
		sendable = confirmed
	}

	total := raw.Total
	if total == "" {
		cf, _ := strconv.ParseFloat(confirmed, 64)
		uf, _ := strconv.ParseFloat(unconfirmed, 64)
		total = strconv.FormatFloat(cf+uf, 'f', -1, 64)
	}

	var metaName, metaTicker, metaArtimage, metaWebvalidate string
	var metaDecimals interface{}

	if raw.Token != nil {
		if tokenMap, ok := raw.Token.(map[string]interface{}); ok {
			if v, ok := tokenMap["name"].(string); ok {
				metaName = v
			}
			if v, ok := tokenMap["ticker"].(string); ok {
				metaTicker = v
			}
			if v, ok := tokenMap["decimals"]; ok {
				metaDecimals = v
			}
			if v, ok := tokenMap["artimage"].(string); ok {
				metaArtimage = v
			}
			if v, ok := tokenMap["webvalidate"].(string); ok {
				metaWebvalidate = v
			}
		}
	}

	name := raw.Name
	if name == "" {
		name = metaName
	}
	ticker := raw.Ticker
	if ticker == "" {
		ticker = metaTicker
	}

	decimalsRaw := raw.Decimals
	if decimalsRaw == nil {
		decimalsRaw = metaDecimals
	}
	if decimalsRaw == nil {
		if tokenID == "0x00" {
			decimalsRaw = float64(8)
		} else {
			decimalsRaw = float64(0)
		}
	}

	var decimals int
	switch v := decimalsRaw.(type) {
	case float64:
		decimals = int(v)
	case string:
		decimals, _ = strconv.Atoi(v)
	case json.Number:
		d, _ := v.Int64()
		decimals = int(d)
	}

	artimage := raw.Artimage
	if artimage == "" {
		artimage = metaArtimage
	}
	webvalidate := raw.Webvalidate
	if webvalidate == "" {
		webvalidate = metaWebvalidate
	}

	kind := ClassifyKind(tokenID, decimals, total, artimage)

	return PortfolioEntry{
		Kind:        kind,
		TokenID:     tokenID,
		Confirmed:   confirmed,
		Unconfirmed: unconfirmed,
		Sendable:    sendable,
		Total:       total,
		Decimals:    decimals,
		Name:        name,
		Ticker:      ticker,
		Artimage:    artimage,
		Webvalidate: webvalidate,
		Address:     address,
	}
}

func init() {
	_ = strings.TrimSpace
}
