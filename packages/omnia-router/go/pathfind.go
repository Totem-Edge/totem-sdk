package omniarouter

import (
	"math/big"
	"sort"
	"strconv"
	"strings"
)

const defaultMaxHops = 8

type searchParent struct {
	prevNode string
	edge     ChannelGraphEdge
}

type searchLabel struct {
	totalFees *big.Int
	parent    *searchParent
}

func FindRoute(graph *ChannelGraph, from, to, amountStr, tokenID string, opts *RouteOptions) *Route {
	maxHops := defaultMaxHops
	if opts != nil {
		maxHops = opts.MaxHops
	}
	if maxHops < 0 {
		return nil
	}
	amount, ok := new(big.Int).SetString(amountStr, 10)
	if !ok || amount.Sign() <= 0 {
		return nil
	}
	if isZeroFeeToken(graph, tokenID) {
		return bfsRoute(graph, from, to, amount, amountStr, tokenID, maxHops)
	}
	return reconstruct(graph, from, to, amount, amountStr, tokenID, maxHops)
}

// isZeroFeeToken reports whether every edge for tokenID has a zero fee.
func isZeroFeeToken(graph *ChannelGraph, tokenID string) bool {
	for _, edges := range graph.NodeEdges {
		for _, edge := range edges {
			if edge.TokenID != tokenID {
				continue
			}
			feeRate, ok := new(big.Int).SetString(edge.FeeRate, 10)
			if !ok || feeRate.Sign() != 0 {
				return false
			}
		}
	}
	return true
}

// bfsRoute is the fewest-hop search for zero-fee single-token graphs.
func bfsRoute(graph *ChannelGraph, from, to string, amount *big.Int, amountStr, tokenID string, maxHops int) *Route {
	if from == to {
		return &Route{Hops: nil, TotalFees: "0", TokenIn: tokenID, TokenOut: tokenID, EstimatedBlocks: 0}
	}

	visited := map[string]bool{from: true}
	parents := map[string]*searchParent{}
	frontier := []string{from}

	for depth := 1; depth <= maxHops && len(frontier) > 0; depth++ {
		next := make([]string, 0)
		for _, u := range frontier {
			edges := append([]ChannelGraphEdge(nil), graph.NodeEdges[u]...)
			sort.Slice(edges, func(i, j int) bool {
				return edgeKey(edges[i]) < edgeKey(edges[j])
			})
			for _, edge := range edges {
				if edge.TokenID != tokenID {
					continue
				}
				feeRate, ok := new(big.Int).SetString(edge.FeeRate, 10)
				if !ok || feeRate.Sign() < 0 {
					continue
				}
				balance, ok := new(big.Int).SetString(edge.AvailableBalance, 10)
				if !ok || balance.Cmp(amount) < 0 {
					continue
				}
				if visited[edge.To] {
					continue
				}

				visited[edge.To] = true
				copied := edge
				parents[edge.To] = &searchParent{prevNode: u, edge: copied}
				if edge.To == to {
					hops := reconstructFromParents(parents, from, to, amountStr, tokenID)
					return &Route{
						Hops:            hopsToInterface(hops),
						TotalFees:       "0",
						TokenIn:         tokenID,
						TokenOut:        tokenID,
						EstimatedBlocks: len(hops) * 2,
					}
				}
				next = append(next, edge.To)
			}
		}
		frontier = next
	}

	return nil
}

func reconstructFromParents(parents map[string]*searchParent, from, to, amountStr, tokenID string) []RoutingHop {
	hops := make([]RoutingHop, 0)
	current := to
	for current != from {
		parent := parents[current]
		if parent == nil {
			break
		}
		edge := parent.edge
		hops = append(hops, RoutingHop{
			ChannelID: edge.ChannelID,
			From:      edge.From,
			To:        edge.To,
			Amount:    amountStr,
			TokenID:   tokenID,
		})
		current = parent.prevNode
	}
	for i, j := 0, len(hops)-1; i < j; i, j = i+1, j-1 {
		hops[i], hops[j] = hops[j], hops[i]
	}
	return hops
}

// reconstruct runs a layered (hops, node) shortest path. dist[h][v] is the
// cheapest path from `from` to `v` using exactly h edges; the result is the
// cheapest (totalFees, hops) over h = 0…maxHops with a deterministic
// path tie-break.
func reconstruct(graph *ChannelGraph, from, to string, amount *big.Int, amountStr, tokenID string, maxHops int) *Route {
	if from == to {
		return &Route{Hops: nil, TotalFees: "0", TokenIn: tokenID, TokenOut: tokenID, EstimatedBlocks: 0}
	}
	layers := computeLayers(graph, from, amount, tokenID, maxHops)
	return routeFromLayers(layers, to, amountStr, tokenID, maxHops)
}

// computeLayers runs the layered (hops, node) search shared by point-to-point
// and cross-token routing. layers[h][v] is the cheapest path using exactly h edges.
func computeLayers(graph *ChannelGraph, from string, amount *big.Int, tokenID string, maxHops int) []map[string]*searchLabel {
	layers := make([]map[string]*searchLabel, maxHops+1)
	for i := range layers {
		layers[i] = make(map[string]*searchLabel)
	}
	layers[0][from] = &searchLabel{totalFees: big.NewInt(0)}

	for h := 1; h <= maxHops; h++ {
		prev := layers[h-1]
		if len(prev) == 0 {
			break
		}
		curr := layers[h]

		for u, label := range prev {
			for _, edge := range graph.NodeEdges[u] {
				if edge.TokenID != tokenID {
					continue
				}
				feeRate, ok := new(big.Int).SetString(edge.FeeRate, 10)
				if !ok || feeRate.Sign() < 0 {
					continue
				}
				balance, ok := new(big.Int).SetString(edge.AvailableBalance, 10)
				if !ok || balance.Cmp(amount) < 0 {
					continue
				}

				fee := edgeFee(amount, edge)
				newFees := new(big.Int).Add(label.totalFees, fee)
				parent := &searchParent{prevNode: u, edge: edge}

				existing := curr[edge.To]
				if existing == nil || betterSameLayer(newFees, parent, existing, h, edge.To, layers) {
					curr[edge.To] = &searchLabel{totalFees: newFees, parent: parent}
				}
			}
		}
	}

	return layers
}

func routeFromLayers(layers []map[string]*searchLabel, to, amountStr, tokenID string, maxHops int) *Route {
	bestH := -1
	var bestFees *big.Int
	for h := 0; h <= maxHops; h++ {
		label := layers[h][to]
		if label == nil {
			continue
		}
		if bestH == -1 ||
			label.totalFees.Cmp(bestFees) < 0 ||
			(label.totalFees.Cmp(bestFees) == 0 && h < bestH) {
			bestH = h
			bestFees = new(big.Int).Set(label.totalFees)
		}
	}
	if bestH == -1 {
		return nil
	}

	hops := reconstructFromLayers(layers, bestH, to, amountStr, tokenID)
	return &Route{
		Hops:            hopsToInterface(hops),
		TotalFees:       bestFees.String(),
		TokenIn:         tokenID,
		TokenOut:        tokenID,
		EstimatedBlocks: len(hops) * 2,
	}
}

func betterSameLayer(
	newFees *big.Int,
	parent *searchParent,
	existing *searchLabel,
	h int,
	node string,
	layers []map[string]*searchLabel,
) bool {
	cmp := newFees.Cmp(existing.totalFees)
	if cmp != 0 {
		return cmp < 0
	}
	return parentKey(parent, h-1, layers) < pathKey(h, node, layers)
}

func pathKey(h int, node string, layers []map[string]*searchLabel) string {
	parts := make([]string, 0, h)
	current := node
	for layer := h; layer > 0; layer-- {
		label := layers[layer][current]
		if label == nil || label.parent == nil {
			break
		}
		parts = append(parts, edgeKey(label.parent.edge))
		current = label.parent.prevNode
	}
	for i, j := 0, len(parts)-1; i < j; i, j = i+1, j-1 {
		parts[i], parts[j] = parts[j], parts[i]
	}
	return strings.Join(parts, ">")
}

func parentKey(parent *searchParent, hPrev int, layers []map[string]*searchLabel) string {
	prefix := edgeKey(parent.edge)
	if hPrev == 0 {
		return prefix
	}
	rest := pathKey(hPrev, parent.prevNode, layers)
	if rest == "" {
		return prefix
	}
	return prefix + ">" + rest
}

func edgeKey(edge ChannelGraphEdge) string {
	return edgeKeyFields(edge.ChannelID, edge.From, edge.To)
}

func edgeKeyFromHop(hop RoutingHop) string {
	return edgeKeyFields(hop.ChannelID, hop.From, hop.To)
}

func edgeKeyFields(channelID, from, to string) string {
	return channelID + "|" + from + "|" + to
}

func reconstructFromLayers(
	layers []map[string]*searchLabel,
	h int,
	to, amountStr, tokenID string,
) []RoutingHop {
	hops := make([]RoutingHop, 0, h)
	current := to
	for layer := h; layer > 0; layer-- {
		label := layers[layer][current]
		if label == nil || label.parent == nil {
			break
		}
		edge := label.parent.edge
		hops = append(hops, RoutingHop{
			ChannelID: edge.ChannelID,
			From:      edge.From,
			To:        edge.To,
			Amount:    amountStr,
			TokenID:   tokenID,
		})
		current = label.parent.prevNode
	}
	for i, j := 0, len(hops)-1; i < j; i, j = i+1, j-1 {
		hops[i], hops[j] = hops[j], hops[i]
	}
	return hops
}

func FindCrossTokenRoute(graph *ChannelGraph, from, to, amountInStr, tokenIn, tokenOut string, opts *RouteOptions) *CrossTokenRoute {
	announcements := graph.GetSwapAnnouncements(tokenIn, tokenOut)
	if len(announcements) == 0 {
		return nil
	}

	maxHops := defaultMaxHops
	if opts != nil {
		maxHops = opts.MaxHops
	}
	if maxHops < 1 {
		return nil
	}

	amountIn, ok := new(big.Int).SetString(amountInStr, 10)
	if !ok || amountIn.Sign() <= 0 {
		return nil
	}

	// One bounded inbound search serves every announcement (RFC-055 §2.5).
	preLayers := computeLayers(graph, from, amountIn, tokenIn, maxHops-1)
	postCache := make(map[string][]map[string]*searchLabel)
	var best *CrossTokenRoute

	for _, ann := range announcements {
		maxAmountIn, ok := new(big.Int).SetString(ann.MaxAmountIn, 10)
		if !ok || amountIn.Cmp(maxAmountIn) > 0 {
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
		inboundBalance, _ := new(big.Int).SetString(inboundEdge.AvailableBalance, 10)
		if inboundBalance.Cmp(amountIn) < 0 {
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
		outboundBalance, _ := new(big.Int).SetString(outboundEdge.AvailableBalance, 10)
		if outboundBalance.Cmp(amountOut) < 0 {
			continue
		}

		preSrc := inboundEdge.From
		postDst := outboundEdge.To

		postKey := postDst + "|" + amountOut.String() + "|" + tokenOut + "|" + strconv.Itoa(maxHops-1)
		postLayers, exists := postCache[postKey]
		if !exists {
			postLayers = computeLayers(graph, postDst, amountOut, tokenOut, maxHops-1)
			postCache[postKey] = postLayers
		}

		inboundFee := edgeFee(amountIn, *inboundEdge)
		outboundFee := edgeFee(amountOut, *outboundEdge)

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

		for preH := 0; preH <= maxHops-1; preH++ {
			preLabel := preLayers[preH][preSrc]
			if preLabel == nil {
				continue
			}
			for postH := 0; postH <= maxHops-1-preH; postH++ {
				postLabel := postLayers[postH][to]
				if postLabel == nil {
					continue
				}

				preHops := reconstructFromLayers(preLayers, preH, preSrc, amountInStr, tokenIn)
				postHops := reconstructFromLayers(postLayers, postH, to, amountOut.String(), tokenOut)

				allHops := make([]interface{}, 0, len(preHops)+1+len(postHops))
				for _, h := range preHops {
					allHops = append(allHops, h)
				}
				allHops = append(allHops, swapHop)
				for _, h := range postHops {
					allHops = append(allHops, h)
				}

				totalFees := new(big.Int).Set(preLabel.totalFees)
				totalFees.Add(totalFees, inboundFee)
				totalFees.Add(totalFees, outboundFee)
				totalFees.Add(totalFees, postLabel.totalFees)

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
		}
	}

	return best
}

func crossTokenBetter(a, b *CrossTokenRoute) bool {
	aFees, _ := new(big.Int).SetString(a.TotalFees, 10)
	bFees, _ := new(big.Int).SetString(b.TotalFees, 10)
	cmp := aFees.Cmp(bFees)
	if cmp != 0 {
		return cmp < 0
	}
	if len(a.Hops) != len(b.Hops) {
		return len(a.Hops) < len(b.Hops)
	}
	if len(a.SwapHops) != len(b.SwapHops) {
		return len(a.SwapHops) < len(b.SwapHops)
	}
	return hopsRouteKey(a.Hops) < hopsRouteKey(b.Hops)
}

func hopsRouteKey(hops []interface{}) string {
	parts := make([]string, 0, len(hops))
	for _, hop := range hops {
		switch h := hop.(type) {
		case SwapHop:
			parts = append(parts, "swap:"+h.ChannelID+":"+h.OutboundChannelID)
		case RoutingHop:
			parts = append(parts, edgeKeyFromHop(h))
		}
	}
	return strings.Join(parts, ">")
}

func hopsToInterface(hops []RoutingHop) []interface{} {
	result := make([]interface{}, len(hops))
	for i, h := range hops {
		result[i] = h
	}
	return result
}
