package omniarouter

import (
	"math/big"
	"sort"
)

type dijkstraState struct {
	node      string
	totalFees *big.Int
	hops      int
	path      []RoutingHop
}

func FindRoute(graph *ChannelGraph, from, to, amountStr, tokenID string, opts *RouteOptions) *Route {
	maxHops := 8
	if opts != nil && opts.MaxHops > 0 {
		maxHops = opts.MaxHops
	}
	return reconstruct(graph, from, to, amountStr, tokenID, maxHops)
}

func reconstruct(graph *ChannelGraph, from, to, amountStr, tokenID string, maxHops int) *Route {
	amount, ok := new(big.Int).SetString(amountStr, 10)
	if !ok {
		return nil
	}

	type bestDist struct {
		totalFees *big.Int
		hops      int
		path      []RoutingHop
	}
	dist := make(map[string]*bestDist)
	queue := []dijkstraState{{node: from, totalFees: big.NewInt(0), hops: 0, path: nil}}
	dist[from] = &bestDist{totalFees: big.NewInt(0), hops: 0, path: nil}

	for len(queue) > 0 {
		state := dequeue(&queue)

		if state.node == to {
			return &Route{
				Hops:            hopsToInterface(state.path),
				TotalFees:       state.totalFees.String(),
				TokenIn:         tokenID,
				TokenOut:        tokenID,
				EstimatedBlocks: len(state.path) * 2,
			}
		}

		if state.hops >= maxHops {
			continue
		}

		for _, edge := range graph.NodeEdges[state.node] {
			if edge.TokenID != tokenID {
				continue
			}
			edgeBalance, _ := new(big.Int).SetString(edge.AvailableBalance, 10)
			if edgeBalance.Cmp(amount) < 0 {
				continue
			}

			fee := edgeFee(amount, edge)
			newFees := new(big.Int).Add(state.totalFees, fee)
			newHops := state.hops + 1

			best, exists := dist[edge.To]
			if exists && notBetter(newFees, newHops, best.totalFees, best.hops) {
				continue
			}

			hop := RoutingHop{
				ChannelID: edge.ChannelID,
				From:      edge.From,
				To:        edge.To,
				Amount:    amountStr,
				TokenID:   tokenID,
			}
			newPath := make([]RoutingHop, len(state.path))
			copy(newPath, state.path)
			newPath = append(newPath, hop)

			dist[edge.To] = &bestDist{totalFees: new(big.Int{}).Set(newFees), hops: newHops, path: newPath}
			enqueue(&queue, dijkstraState{node: edge.To, totalFees: newFees, hops: newHops, path: newPath})
		}
	}

	best, exists := dist[to]
	if !exists {
		return nil
	}
	return &Route{
		Hops:            hopsToInterface(best.path),
		TotalFees:       best.totalFees.String(),
		TokenIn:         tokenID,
		TokenOut:        tokenID,
		EstimatedBlocks: len(best.path) * 2,
	}
}

func FindCrossTokenRoute(graph *ChannelGraph, from, to, amountInStr, tokenIn, tokenOut string, opts *RouteOptions) *CrossTokenRoute {
	announcements := graph.GetSwapAnnouncements(tokenIn, tokenOut)
	if len(announcements) == 0 {
		return nil
	}

	amountIn, ok := new(big.Int).SetString(amountInStr, 10)
	if !ok {
		return nil
	}

	var best *CrossTokenRoute

	for _, ann := range announcements {
		maxAmountIn, _ := new(big.Int).SetString(ann.MaxAmountIn, 10)
		if amountIn.Cmp(maxAmountIn) > 0 {
			continue
		}

		inboundEdges := graph.EdgesByChannel[ann.InboundChannelID]
		var inboundEdge *ChannelGraphEdge
		for i := range inboundEdges {
			if inboundEdges[i].To == ann.IntermediaryPubKey && inboundEdges[i].TokenID == tokenIn {
				inboundEdge = &inboundEdges[i]
				break
			}
		}
		if inboundEdge == nil {
			continue
		}

		edgeBalance, _ := new(big.Int).SetString(inboundEdge.AvailableBalance, 10)
		if edgeBalance.Cmp(amountIn) < 0 {
			continue
		}

		amountOut := ApplyRate(amountIn, ann.Rate)
		if amountOut.Sign() <= 0 {
			continue
		}

		outboundEdges := graph.EdgesByChannel[ann.OutboundChannelID]
		var outboundEdge *ChannelGraphEdge
		for i := range outboundEdges {
			if outboundEdges[i].From == ann.IntermediaryPubKey && outboundEdges[i].TokenID == tokenOut {
				outboundEdge = &outboundEdges[i]
				break
			}
		}
		if outboundEdge == nil {
			continue
		}

		outBalance, _ := new(big.Int).SetString(outboundEdge.AvailableBalance, 10)
		if outBalance.Cmp(amountOut) < 0 {
			continue
		}

		preSrc := inboundEdge.From
		postDst := outboundEdge.To

		var preRoute *Route
		if from == preSrc {
			preRoute = &Route{Hops: nil, TotalFees: "0", TokenIn: tokenIn, TokenOut: tokenIn, EstimatedBlocks: 0}
		} else {
			preRoute = FindRoute(graph, from, preSrc, amountInStr, tokenIn, opts)
		}
		if preRoute == nil {
			continue
		}

		var postRoute *Route
		if postDst == to {
			postRoute = &Route{Hops: nil, TotalFees: "0", TokenIn: tokenOut, TokenOut: tokenOut, EstimatedBlocks: 0}
		} else {
			postRoute = FindRoute(graph, postDst, to, amountOut.String(), tokenOut, opts)
		}
		if postRoute == nil {
			continue
		}

		swapHop := SwapHop{
			RoutingHop: RoutingHop{
				ChannelID: ann.InboundChannelID,
				From:      preSrc,
				To:        postDst,
				Amount:    amountInStr,
				TokenID:   tokenIn,
			},
			IsSwap:            true,
			TokenIn:           tokenIn,
			TokenOut:          tokenOut,
			AmountIn:          amountInStr,
			AmountOut:         amountOut.String(),
			Rate:              ann.Rate,
			InboundChannelID:  ann.InboundChannelID,
			OutboundChannelID: ann.OutboundChannelID,
		}

		inboundFee := edgeFee(amountIn, *inboundEdge)
		outboundFee := edgeFee(amountOut, *outboundEdge)

		preFees, _ := new(big.Int).SetString(preRoute.TotalFees, 10)
		postFees, _ := new(big.Int).SetString(postRoute.TotalFees, 10)
		totalFees := new(big.Int).Add(preFees, inboundFee)
		totalFees.Add(totalFees, outboundFee)
		totalFees.Add(totalFees, postFees)

		allHops := make([]interface{}, 0)
		for _, h := range preRoute.Hops {
			allHops = append(allHops, h)
		}
		allHops = append(allHops, swapHop)
		for _, h := range postRoute.Hops {
			allHops = append(allHops, h)
		}

		candidate := &CrossTokenRoute{
			Route: Route{
				Hops:            allHops,
				TotalFees:       totalFees.String(),
				TokenIn:         tokenIn,
				TokenOut:        tokenOut,
				EstimatedBlocks: len(allHops) * 2,
			},
			SwapHops: []SwapHop{swapHop},
		}

		if best == nil || crossTokenBetter(candidate, best) {
			best = candidate
		}
	}

	return best
}

func notBetter(newFees *big.Int, newHops int, bestFees *big.Int, bestHops int) bool {
	cmp := newFees.Cmp(bestFees)
	if cmp > 0 {
		return true
	}
	if cmp < 0 {
		return false
	}
	return newHops >= bestHops
}

func crossTokenBetter(a, b *CrossTokenRoute) bool {
	aFees, _ := new(big.Int).SetString(a.TotalFees, 10)
	bFees, _ := new(big.Int).SetString(b.TotalFees, 10)
	cmp := aFees.Cmp(bFees)
	if cmp < 0 {
		return true
	}
	if cmp > 0 {
		return false
	}
	if len(a.Hops) < len(b.Hops) {
		return true
	}
	if len(a.Hops) > len(b.Hops) {
		return false
	}
	return len(a.SwapHops) < len(b.SwapHops)
}

func dequeue(queue *[]dijkstraState) dijkstraState {
	minIdx := 0
	for i := 1; i < len(*queue); i++ {
		a := (*queue)[i]
		b := (*queue)[minIdx]
		cmp := a.totalFees.Cmp(b.totalFees)
		if cmp < 0 || (cmp == 0 && a.hops < b.hops) {
			minIdx = i
		}
	}
	state := (*queue)[minIdx]
	*queue = append((*queue)[:minIdx], (*queue)[minIdx+1:]...)
	return state
}

func enqueue(queue *[]dijkstraState, state dijkstraState) {
	*queue = append(*queue, state)
}

func hopsToInterface(hops []RoutingHop) []interface{} {
	result := make([]interface{}, len(hops))
	for i, h := range hops {
		result[i] = h
	}
	return result
}

func init() {
	_ = sort.IntSlice{}
}
