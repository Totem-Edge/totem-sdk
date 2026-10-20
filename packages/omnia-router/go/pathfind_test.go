package omniarouter

import (
	"fmt"
	"math/big"
	"testing"
)

const testScale = 100_000_000

func testEdge(id, from, to, fee string) ChannelGraphEdge {
	balance := new(big.Int).Mul(big.NewInt(1_000_000), big.NewInt(testScale)).String()
	return ChannelGraphEdge{
		ChannelID:        id,
		From:             from,
		To:               to,
		TokenID:          "tok",
		AvailableBalance: balance,
		HTLCCapacity:     balance,
		FeeRate:          fee,
	}
}

func mustAdd(t *testing.T, g *ChannelGraph, edge ChannelGraphEdge) {
	t.Helper()
	if err := g.AddChannel(edge); err != nil {
		t.Fatalf("AddChannel(%s): %v", edge.ChannelID, err)
	}
}

func TestBoundedHopConstrained(t *testing.T) {
	g := NewChannelGraph()
	// Low-fee path to X: 4 hops, fee 2.
	mustAdd(t, g, testEdge("s-a1", "S", "A1", "0"))
	mustAdd(t, g, testEdge("a1-a2", "A1", "A2", "0"))
	mustAdd(t, g, testEdge("a2-a3", "A2", "A3", "0"))
	mustAdd(t, g, testEdge("a3-x", "A3", "X", "2"))
	// High-fee path to X: 2 hops, fee 3.
	mustAdd(t, g, testEdge("s-b1", "S", "B1", "1"))
	mustAdd(t, g, testEdge("b1-x", "B1", "X", "2"))
	// Target needs 2 more hops from X.
	mustAdd(t, g, testEdge("x-t1", "X", "T1", "0"))
	mustAdd(t, g, testEdge("t1-t", "T1", "T", "0"))

	amount := new(big.Int).SetInt64(testScale).String()

	bounded := FindRoute(g, "S", "T", amount, "tok", &RouteOptions{MaxHops: 5})
	if bounded == nil {
		t.Fatal("expected a route within 5 hops")
	}
	if bounded.TotalFees != "3" {
		t.Fatalf("maxHops=5 totalFees=%s, want 3", bounded.TotalFees)
	}
	if len(bounded.Hops) != 4 {
		t.Fatalf("maxHops=5 hops=%d, want 4", len(bounded.Hops))
	}
	first, ok := bounded.Hops[0].(RoutingHop)
	if !ok || first.ChannelID != "s-b1" {
		t.Fatalf("maxHops=5 first hop=%#v, want s-b1", bounded.Hops[0])
	}

	longer := FindRoute(g, "S", "T", amount, "tok", &RouteOptions{MaxHops: 6})
	if longer == nil {
		t.Fatal("expected a route within 6 hops")
	}
	if longer.TotalFees != "2" {
		t.Fatalf("maxHops=6 totalFees=%s, want 2", longer.TotalFees)
	}
	if len(longer.Hops) != 6 {
		t.Fatalf("maxHops=6 hops=%d, want 6", len(longer.Hops))
	}
}

func TestZeroFeePrefersFewestHops(t *testing.T) {
	g := NewChannelGraph()
	mustAdd(t, g, testEdge("s-t", "S", "T", "0"))
	mustAdd(t, g, testEdge("s-a", "S", "A", "0"))
	mustAdd(t, g, testEdge("a-t", "A", "T", "0"))

	amount := new(big.Int).SetInt64(testScale).String()
	route := FindRoute(g, "S", "T", amount, "tok", nil)
	if route == nil {
		t.Fatal("expected route")
	}
	if route.TotalFees != "0" {
		t.Fatalf("totalFees=%s, want 0", route.TotalFees)
	}
	if len(route.Hops) != 1 {
		t.Fatalf("hops=%d, want 1 (direct)", len(route.Hops))
	}
}

func TestMaxHopsAndValidation(t *testing.T) {
	g := NewChannelGraph()
	mustAdd(t, g, testEdge("s-t", "S", "T", "0"))
	amount := new(big.Int).SetInt64(testScale).String()

	if route := FindRoute(g, "S", "T", amount, "tok", &RouteOptions{MaxHops: -1}); route != nil {
		t.Fatal("negative maxHops should return nil")
	}
	if route := FindRoute(g, "S", "T", "0", "tok", nil); route != nil {
		t.Fatal("zero amount should return nil")
	}
	if err := g.AddChannel(testEdge("neg-fee", "S", "T", "-1")); err == nil {
		t.Fatal("negative feeRate should be rejected")
	}
}

func TestCrossTokenGlobalHopBudget(t *testing.T) {
	g := NewChannelGraph()
	a := []string{"S", "p1", "p2", "p3", "p4", "pre"}
	for i := 0; i < len(a)-1; i++ {
		mustAdd(t, g, testEdge(fmt.Sprintf("a%d", i), a[i], a[i+1], "0"))
	}
	mustAdd(t, g, testEdge("in-chan", "pre", "BRIDGE", "0"))

	out := testEdge("out-chan", "BRIDGE", "post", "0")
	out.TokenID = "tokB"
	mustAdd(t, g, out)

	b := []string{"post", "q1", "q2", "q3", "q4", "T"}
	for i := 0; i < len(b)-1; i++ {
		e := testEdge(fmt.Sprintf("b%d", i), b[i], b[i+1], "0")
		e.TokenID = "tokB"
		mustAdd(t, g, e)
	}

	maxAmountIn := new(big.Int).Mul(big.NewInt(1_000_000), big.NewInt(testScale)).String()
	if err := g.AnnounceSwap(SwapAnnouncement{
		IntermediaryPubKey: "BRIDGE",
		TokenIn:            "tok",
		TokenOut:           "tokB",
		Rate:               "1",
		InboundChannelID:   "in-chan",
		OutboundChannelID:  "out-chan",
		MaxAmountIn:        maxAmountIn,
	}); err != nil {
		t.Fatal(err)
	}

	amount := big.NewInt(testScale).String()
	if route := FindCrossTokenRoute(g, "S", "T", amount, "tok", "tokB", &RouteOptions{MaxHops: 8}); route != nil {
		t.Fatalf("expected nil at maxHops=8, got %#v", route)
	}

	route := FindCrossTokenRoute(g, "S", "T", amount, "tok", "tokB", &RouteOptions{MaxHops: 11})
	if route == nil {
		t.Fatal("expected route at maxHops=11")
	}
	if len(route.Hops) != 11 {
		t.Fatalf("hops=%d, want 11", len(route.Hops))
	}
	if len(route.SwapHops) != 1 {
		t.Fatalf("swapHops=%d, want 1", len(route.SwapHops))
	}
}
