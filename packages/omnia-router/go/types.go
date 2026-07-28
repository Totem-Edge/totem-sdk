package omniarouter

import "math/big"

const Scale = 100_000_000

type ChannelParty struct {
	PartyID         string `json:"partyId"`
	PublicKeyDigest string `json:"publicKeyDigest"`
	AddressIndex    uint32 `json:"addressIndex"`
}

type ChannelHTLC struct {
	HtlcID                   string `json:"htlcId"`
	Amount                   string `json:"amount"`
	Hashlock                 string `json:"hashlock"`
	TimeoutBlock             string `json:"timeoutBlock"`
	Direction                string `json:"direction"`
	Status                   string `json:"status"`
	HtlcAddress              string `json:"htlcAddress"`
	SenderPublicKeyDigest    string `json:"senderPublicKeyDigest"`
	RecipientPublicKeyDigest string `json:"recipientPublicKeyDigest"`
}

type RouterChannel struct {
	ChannelID      string           `json:"channelId"`
	TokenID        string           `json:"tokenId"`
	Parties        []ChannelParty   `json:"parties"`
	Balances       map[string]string `json:"balances"`
	PendingHTLCs   []ChannelHTLC    `json:"pendingHTLCs"`
	TotalValue     string           `json:"totalValue"`
	CurrentSequence uint32          `json:"currentSequence"`
	Status         string           `json:"status"`
}

type ChannelGraphEdge struct {
	ChannelID        string `json:"channelId"`
	From             string `json:"from"`
	To               string `json:"to"`
	TokenID          string `json:"tokenId"`
	AvailableBalance string `json:"availableBalance"`
	HTLCCapacity     string `json:"htlcCapacity"`
	FeeRate          string `json:"feeRate"`
}

type SwapAnnouncement struct {
	IntermediaryPubKey string `json:"intermediaryPubKey"`
	TokenIn            string `json:"tokenIn"`
	TokenOut           string `json:"tokenOut"`
	Rate               string `json:"rate"`
	InboundChannelID   string `json:"inboundChannelId"`
	OutboundChannelID  string `json:"outboundChannelId"`
	MaxAmountIn        string `json:"maxAmountIn"`
}

type RoutingHop struct {
	ChannelID string `json:"channelId"`
	From      string `json:"from"`
	To        string `json:"to"`
	Amount    string `json:"amount"`
	TokenID   string `json:"tokenId"`
	HtlcID    string `json:"htlcId,omitempty"`
}

type SwapHop struct {
	RoutingHop
	IsSwap            bool   `json:"isSwap"`
	TokenIn           string `json:"tokenIn"`
	TokenOut          string `json:"tokenOut"`
	AmountIn          string `json:"amountIn"`
	AmountOut         string `json:"amountOut"`
	Rate              string `json:"rate"`
	InboundChannelID  string `json:"inboundChannelId"`
	OutboundChannelID string `json:"outboundChannelId"`
}

type Route struct {
	Hops            []interface{} `json:"hops"`
	TotalFees       string        `json:"totalFees"`
	TokenIn         string        `json:"tokenIn"`
	TokenOut        string        `json:"tokenOut"`
	EstimatedBlocks int           `json:"estimatedBlocks"`
}

type CrossTokenRoute struct {
	Route
	SwapHops []SwapHop `json:"swapHops"`
}

type PaymentRequest struct {
	Hashlock    string `json:"hashlock"`
	Preimage    string `json:"preimage,omitempty"`
	Amount      string `json:"amount"`
	TokenID     string `json:"tokenId"`
	ExpiryBlock string `json:"expiryBlock"`
	Description string `json:"description,omitempty"`
}

type PaymentResult struct {
	Success     bool     `json:"success"`
	Preimage    string   `json:"preimage,omitempty"`
	Error       string   `json:"error,omitempty"`
	SettledHops []string `json:"settledHops"`
}

type RouteOptions struct {
	MaxHops int
}

type ChannelGraph struct {
	NodeEdges      map[string][]ChannelGraphEdge
	EdgesByChannel map[string][]ChannelGraphEdge
	SwapIndex      map[string][]SwapAnnouncement
}

func NewChannelGraph() *ChannelGraph {
	return &ChannelGraph{
		NodeEdges:      make(map[string][]ChannelGraphEdge),
		EdgesByChannel: make(map[string][]ChannelGraphEdge),
		SwapIndex:      make(map[string][]SwapAnnouncement),
	}
}

func ParseRateToScaled(rate string) *big.Int {
	neg := false
	s := rate
	if len(s) > 0 && s[0] == '-' {
		neg = true
		s = s[1:]
	}

	dot := -1
	for i, c := range s {
		if c == '.' {
			dot = i
			break
		}
	}

	intPart := "0"
	fracPart := ""
	if dot == -1 {
		intPart = s
	} else {
		if dot > 0 {
			intPart = s[:dot]
		}
		fracPart = s[dot+1:]
	}

	if len(fracPart) > 8 {
		fracPart = fracPart[:8]
	}
	for len(fracPart) < 8 {
		fracPart += "0"
	}

	scale := big.NewInt(Scale)
	intBig, _ := new(big.Int).SetString(intPart, 10)
	fracBig, _ := new(big.Int).SetString(fracPart, 10)

	result := new(big.Int).Mul(intBig, scale)
	result.Add(result, fracBig)

	if neg {
		result.Neg(result)
	}
	return result
}

func ApplyRate(amountIn *big.Int, rate string) *big.Int {
	rateScaled := ParseRateToScaled(rate)
	result := new(big.Int).Mul(amountIn, rateScaled)
	result.Div(result, big.NewInt(Scale))
	return result
}
