package omniarouter

import (
	"math/big"
)

func (g *ChannelGraph) AddChannel(edge ChannelGraphEdge) {
	existing := g.EdgesByChannel[edge.ChannelID]

	idx := -1
	for i, e := range existing {
		if e.From == edge.From {
			idx = i
			break
		}
	}
	if idx >= 0 {
		g.removeFromNodeEdges(existing[idx])
		existing[idx] = edge
	} else {
		existing = append(existing, edge)
	}
	g.EdgesByChannel[edge.ChannelID] = existing

	nodeList := g.NodeEdges[edge.From]
	nodeList = append(nodeList, edge)
	g.NodeEdges[edge.From] = nodeList
}

func (g *ChannelGraph) RemoveChannel(channelID string) {
	edges, ok := g.EdgesByChannel[channelID]
	if !ok {
		return
	}
	for _, edge := range edges {
		g.removeFromNodeEdges(edge)
	}
	delete(g.EdgesByChannel, channelID)
}

func (g *ChannelGraph) removeFromNodeEdges(edge ChannelGraphEdge) {
	nodeList := g.NodeEdges[edge.From]
	filtered := make([]ChannelGraphEdge, 0, len(nodeList))
	for _, e := range nodeList {
		if !(e.ChannelID == edge.ChannelID && e.From == edge.From) {
			filtered = append(filtered, e)
		}
	}
	if len(filtered) == 0 {
		delete(g.NodeEdges, edge.From)
	} else {
		g.NodeEdges[edge.From] = filtered
	}
}

func (g *ChannelGraph) AnnounceSwap(announcement SwapAnnouncement) error {
	rateScaled := ParseRateToScaled(announcement.Rate)
	if rateScaled.Sign() <= 0 {
		return &SwapError{
			Intermediary: announcement.IntermediaryPubKey,
			Rate:         announcement.Rate,
		}
	}

	key := swapKey(announcement.TokenIn, announcement.TokenOut)
	list := g.SwapIndex[key]

	idx := -1
	for i, a := range list {
		if a.IntermediaryPubKey == announcement.IntermediaryPubKey &&
			a.InboundChannelID == announcement.InboundChannelID {
			idx = i
			break
		}
	}
	if idx >= 0 {
		list[idx] = announcement
	} else {
		list = append(list, announcement)
	}
	g.SwapIndex[key] = list
	return nil
}

func (g *ChannelGraph) GetSwapAnnouncements(tokenIn, tokenOut string) []SwapAnnouncement {
	return g.SwapIndex[swapKey(tokenIn, tokenOut)]
}

func swapKey(tokenIn, tokenOut string) string {
	return tokenIn + ":" + tokenOut
}

type SwapError struct {
	Intermediary string
	Rate         string
}

func (e *SwapError) Error() string {
	return "Invalid swap rate \"" + e.Rate + "\" from intermediary " + e.Intermediary + ": rate must be positive"
}

func edgeFee(amount *big.Int, edge ChannelGraphEdge) *big.Int {
	feeRate, _ := new(big.Int).SetString(edge.FeeRate, 10)
	result := new(big.Int).Mul(amount, feeRate)
	result.Div(result, big.NewInt(Scale))
	return result
}
