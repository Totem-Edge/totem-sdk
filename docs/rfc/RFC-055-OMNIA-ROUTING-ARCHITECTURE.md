# RFC-055 — Omnia Routing Architecture: Bounded Search, Reusable Trees, and Pluggable Engines

Status: Draft — Phase 1 landed (`@totemsdk/omnia-router@0.4.0`); Phase 2+ not authorised
Created: 2026-10-20
Authors: Totem SDK Contributors
Depends on: RFC-035 (Omnia Peer Coordination), RFC-036 (Settlement Verification), RFC-048 (Omnia Primitive Completeness)
References: **[SSSP-2025]**, **[SSSP-2026]** (see §11)

> **Positioning.** This RFC defines the routing architecture and the first implementation phase for
> Omnia. It references the recent deterministic directed SSSP results — Duan et al. 2025
> (**[SSSP-2025]**) and the improved ICALP 2026 result (**[SSSP-2026]**) — as **future large-scale
> backends**, not as the immediate algorithm. Omnia's production default remains an 8-hop bounded
> search; the immediate work is correctness, reusable search results, and a versioned graph/cost
> model that does not preclude those algorithms.
>
> This RFC is the `OMNIA_ROUTING_ARCHITECTURE.md` deliverable requested for the routing work. It
> authorises Phase 1 only. No new npm package is created; the abstractions live inside
> `@totemsdk/omnia-router`, with `@totemsdk/omnia-host` owning graph lifecycle.

---

## 1. Current state and why it changes

The current router (`packages/omnia-router/src/pathfind.ts`, mirrored in `go/pathfind.go`) is
Dijkstra-shaped but not a correct hop-constrained search:

- The “priority queue” is an array; `_dequeue` scans it and `splice`s — O(n) per extraction.
- Every relaxation copies the whole path (`[...path, hop]`).
- `dist[node]` stores one label `(totalFees, hops)`, and `_notBetter` keeps the cheaper label even
  when it has more hops. For a hop-constrained problem this is unsound: `node` alone is not enough
  state; you need `(node, hops)` (or Pareto labels).
- The counterexample in the prior discussion (7-hop/fee-1 vs 3-hop/fee-2 with `maxHops=5`) is not
  reachable in the current code because expansion stops at `hops >= maxHops`. A valid example:
  reach X via **4 hops / fee 2** or **2 hops / fee 3** with `maxHops=5`, and the target needs two
  more hops. `_notBetter` keeps the 4-hop label, discards the 2-hop label, and the 4-hop path can
  no longer be extended within the budget — while the discarded path could.
- `findCrossTokenRoute` invokes `findRoute` twice per swap announcement, repeating closely related
  searches. It also applies `maxHops` **per segment**, so a cross-token route can use up to
  `2·maxHops + 1` hops; if `maxHops` is meant end-to-end, this is a bug.
- `addChannel` does not validate `feeRate >= 0`; negative weights break both Dijkstra and any
  SSSP backend. `announceSwap` already rejects non-positive swap rates.
- `omnia-host` currently emits `feeRate: 0n` for both directions of every channel, so those
  graphs reduce to **fewest hops** — bounded BFS is sufficient there.

### 1.1 Cost-model assumptions (load-bearing)

The current model computes `fee = amount × feeRate / SCALE` with a **fixed** `amount` at every hop
(`ChannelGraphEdge.feeRate`, one `SCALE = 10^8`). It is path-independent and additive. That is why
a scalar layered DP is exact **today**. If Omnia later deducts fees from the forwarded amount
(the realistic HTLC model), or adds base fees, reliability penalties or `exactOut`, the state must
carry the amount (or Pareto labels); `(h, node)` alone will no longer be sufficient.

## 2. Phase 1 — immediate changes (production work)

1. **Layered bounded shortest path.** Replace `_reconstruct` with `dist[h][v]` for
   `h = 0…H` (`H = maxHops`, default 8), exact layers, no early return at first reach (a longer
   path may have lower fees). Choose the best `(fee, hops)` over `h` at the destination; tie-break
   deterministically by node/path id.
2. **Parent pointers.** Store `parent[h][v]` (and the edge) rather than copying paths; reconstruct
   on demand.
3. **Zero-fee fast path.** For zero-fee single-token graphs, run bounded BFS with parents and the
   same token/capacity filters. BFS is not a whole-route algorithm for cross-token swaps (swap
   rates/fees still apply).
4. **Validation.** Reject `feeRate < 0`, negative `availableBalance`/`htlcCapacity`, invalid
   `maxHops`, and non-positive amounts. Keep exact `bigint` arithmetic.
5. **One-to-many inbound search.** For cross-token routing, compute one bounded search from the
   payer over the inbound token graph and evaluate all swap ingress nodes from that result, instead
   of one `findRoute` per announcement. Combine with the outbound segment under a **global** hop
   budget (`preHops + 1 + postHops ≤ H`), not per-segment budgets.

   *Phase 1.2 implementation:* `findCrossTokenRoute` computes the inbound layer table once,
   caches the outbound layer table per `(postDst, amountOut, tokenOut)`, and enumerates
   `preHops + 1 + postHops ≤ H` combinations with a deterministic tie-break. Amount buckets /
   Pareto labels for the outbound leg remain future work.
6. **Benchmarks.** Add synthetic and realistic graphs (≈1k/10k/100k/1m directed edges) comparing
   the bounded DP against a **binary-heap Dijkstra baseline**, plus the current implementation.
   Measure cold/warm queries, one-to-many trees, route reconstruction, zero-fee and weighted
   graphs, cross-token with many announcements, memory and GC.
7. **Only then** prototype the paper’s BMSSP family (**[SSSP-2025]**) or the improved ICALP 2026
   algorithm (**[SSSP-2026]**) as a separate large-graph backend. Neither is a production default.

## 3. Architecture

### 3.1 Routing engine abstraction

Keep all existing public functions backward compatible. `findRoute()` becomes a stable entry point
that delegates to an engine.

```ts
interface RoutingEngine {
  readonly id: string;
  readonly capabilities: {
    bounded: boolean;
    unbounded: boolean;
    oneToMany: boolean;
    incremental: boolean;
    crossToken: boolean;
  };
  findRoute(graph: RoutingGraphSnapshot, query: RoutingQuery): Route | null;
  computeTree?(graph: RoutingGraphSnapshot, query: RoutingTreeQuery): RoutingTree;
}
```

Backend selection is capability-driven, not algorithm-name checks. Experimental algorithms are
never the default.

### 3.2 Versioned graph snapshots

Separate three concerns, each with a revision/freshness marker:

| Layer | Contains | Changes |
|---|---|---|
| Topology | nodes, directed channels, connectivity, tokens | infrequently |
| Routing economics | fees, swap quotes, limits, policies | periodically |
| Live state | balances, HTLC reservations, failures, availability | frequently |

A query runs against a consistent logical snapshot. Cacheable results identify
`topologyRevision`, `economicsRevision` and `liveRevision`. Keep `ChannelGraph` public
compatibility; no distributed graph database or consensus protocol in this phase.

### 3.3 One-to-many search results

Make reusable search results first-class:

```ts
const tree = router.computeTree({ from, amount, tokenId, maxHops: 8 });
tree.routeTo('node-a'); // reconstruct on demand
```

Store a compact predecessor tree, not thousands of full paths. The tree is parameterised by
source, amount (or amount class), token, cost-policy version, topology/economics/live revisions,
hop constraint and algorithm semantic version.

Zero-fee token graphs use a **BFS layer tree** (shortest-hop labels only); weighted graphs use the
layered DP tree (`labelAt` for each exact hop count, `routeTo` for the cheapest label).

### 3.4 Query model

Internal query fields: `source`, optional `destination`, `amount`, `token`, `targetToken`,
`maxHops`, `objective`/cost policy, `executionBudget`, `graphRevision`.

- `maxHops === undefined` ⇒ default 8 (preserve current semantics).
- `maxHops === null` ⇒ explicit unbounded mode. If unbounded is not implemented by the selected
  engine, **reject it as unsupported**; never silently fall back to 8.

### 3.5 Cost-model separation

Routing optimisation is separate from fee/liquidity policy. A versioned cost-model contract
declares: non-negative weights, additive vs amount-dependent fees, rounding, capacity
requirements and deterministic tie-breaking. Do not assume base fees, compounding forwarding
fees, reliability penalties and cross-token rates are one additive edge weight. A shortest-path
tree must never be reused across cost-model versions just because topology is unchanged.

### 3.6 Algorithm selection

| Query characteristics | Preferred backend |
|---|---|
| Zero-fee, bounded | BFS |
| Weighted, small hop bound, single destination | Hop-aware heap Dijkstra `(node,hops)` |
| Weighted, small hop bound, one-to-many | Layered bounded DP |
| Unbounded, single destination | Binary-heap Dijkstra; A* with admissible heuristic |
| Unbounded, all destinations | Dijkstra SSSP / one-to-many |
| Large, repeat-source | Cached shortest-path trees |
| Large, high-concurrency | Indexed/hierarchical search, potentially parallel SSSP |
| Experimental large-scale exact SSSP | BMSSP (**[SSSP-2025]**) or the improved **2026** result (**[SSSP-2026]**), only after validation |

> **Phase 1 benchmark finding (synthetic, 1k–100k edges).** Zero-fee BFS is the
> right fast path for `omnia-host` graphs (`feeRate: 0n`). For weighted
> single-destination queries, a hop-aware heap Dijkstra `(node,hops)` is
> typically faster than the layered DP; the DP remains the exact reference and
> the basis for one-to-many trees. `findRoute` therefore selects BFS for
> zero-fee token subgraphs and the layered DP for weighted graphs today; a
> hop-aware heap backend is the next engine candidate for weighted
> point-to-point queries.

The 2025 breakthrough has already been improved by **[SSSP-2026]** (ICALP 2026). That is another
reason not to bake a specific algorithm into the architecture.

### 3.7 Cache readiness

Cache keys include every input that affects correctness: source, amount/amount class, token,
cost-policy version, topology revision, fee/liquidity revision, hop constraint, algorithm semantic
version. Never cache an executable liquidity guarantee. Invalidate on channel/balance/fee/swap
changes, failed executions and expired observations. Implement only lightweight, demonstrably safe
caching in Phase 1. A route from a cache or tree MUST be revalidated against live channel state
before execution.

### 3.8 Distributed routing (future seam)

`RoutingEngine` operates on a supplied snapshot and does not depend on a transport. Topology
ingestion stays separate from route calculation so a future global graph can arrive via Totem's
existing transport/discovery/identity/proof infrastructure. No speculative distributed
infrastructure is added now.

## 4. Correctness and invariants

- **State.** `(h, node)` is exact only under the fixed-amount, path-independent cost model; if the
  fee/liquidity model becomes amount-dependent, carry amount or Pareto labels.
- **Global hop budget.** Cross-token routes must enforce one end-to-end `maxHops`, not two segment
  budgets.
- **Determinism.** Equal `(fees, hops)` breaks ties by a deterministic node/path id, in both TS and
  Go.
- **Exact arithmetic.** All monetary values remain `bigint`; no binary floats.
- **Non-negative weights.** Reject negative fees/capacities at insertion.
- **Fail-closed.** Unsupported query modes (e.g. unbounded on a bounded engine) are rejected.
- **Revalidation.** A candidate route from a cache or tree is not a settlement guarantee; validate
  live channel state before locking HTLCs. Implemented in `executeMultiHopPayment` and
  `executeCrossTokenPayment` (up-front and per-lock); failures return
  `ROUTE_REVALIDATION_FAILED` with no locks.
- **Compatibility.** Existing public APIs and semantics are preserved.

## 5. TS/Go parity

Both implementations (`pathfind.ts`, `pathfind.go`) must share the same semantics: layer
definition, dominance/ties, hop-budget combination, validation and error behaviour. Add
cross-language golden vectors and differential tests. Backend implementations may differ; the
semantic contract may not.

## 6. Non-goals

- No new npm package; no distributed graph database or consensus in this phase.
- No speculative rewrite and no experimental algorithm as the default.
- No unbounded mode without an engine that genuinely supports it.
- No reliance on theoretical bounds the implementation does not satisfy.

## 7. Phased roadmap

1. **Now — foundations + the seven changes.** Bounded DP, parents, BFS fast path, validation,
   one-to-many inbound search, backend contract, initial graph revisions, benchmarks.
   *Phase 1 foundations implemented:* internal `routing-engine.ts` provides the `RoutingEngine`
   capability contract, revisioned `RoutingGraphSnapshot`, one-to-many `RoutingTree`
   (`labelAt`/`routeTo`), `FIXED_AMOUNT_COST_MODEL`, and `routeCacheKey`. It is **not** exported
   from the package barrel yet; `findRoute` and `findCrossTokenRoute` consume it.
2. **Next — full SSSP and reusable trees.** Unbounded heap Dijkstra, optional one-to-many queries,
   safe route-tree caching, differential testing, benchmark-driven backend selection.
3. **Network scale — global graph intelligence.** Authenticated discovery, incremental updates,
   routing economics, liquidity confidence, regional indexes, failure-driven invalidation.
4. **Advanced — global optimisation research.** Hierarchical/parallel search and BMSSP successors
   (**[SSSP-2025]**, **[SSSP-2026]**) where benchmarks justify them.

## 8. Acceptance criteria

- Correct hop-constrained results (including the 4-hop vs 2-hop case) and deterministic TS/Go
  parity.
- Zero-fee BFS fast path and validated non-negative fees/capacities.
- One inbound search per cross-token query and a single global hop budget.
- Benchmarks vs a heap-Dijkstra baseline, cold/warm, 1k–1m edges, with recorded memory/GC.
- `docs/OMNIA_ROUTING_ARCHITECTURE.md` (this RFC) kept current as the architecture reference.
- No public API breakage; unbounded mode either implemented or explicitly rejected.

## 9. Relationship to Eefi

Eefi Protocol 0.1 (RFC-054) uses candidate routes for private spot exchange. A route is a
**candidate**, not a guarantee: execution revalidates live channel state. Cross-token capacity and
hop budgets in RFC-054 rely on the global-budget rule in §2.5 and §4.

## 10. Open questions

1. Exact amount-bucket vs Pareto-label representation for outbound cross-token search.
2. Minimum safety margin formula for HTLC timelocks (communication + inclusion + contention +
   recovery) and its relationship to `maxHops`.
3. Whether route-tree caches should be process-local only or shareable through `omnia-host`.
4. Which hierarchical/index structure (if any) is worth maintaining before global graph scale.
5. How liquidity-confidence and failure history feed the cost model without making it
   non-deterministic.

## 11. References

**[SSSP-2025]** Ran Duan, Jiayi Mao, Xiao Mao, Xinkai Shu, Longhui Yin.
“Breaking the Sorting Barrier for Directed Single-Source Shortest Paths.”
arXiv:2504.17033 (v2, 30 Jul 2025). Deterministic `O(m log^{2/3} n)` SSSP for directed graphs with
real non-negative weights. DOI: 10.48550/arXiv.2504.17033.
Canonical: https://arxiv.org/abs/2504.17033 · PDF: https://arxiv.org/pdf/2504.17033

**[SSSP-2026]** Ran Duan, Xiao Mao, Xinkai Shu, Longhui Yin.
“A Faster Directed Single-Source Shortest Path Algorithm.”
53rd International Colloquium on Automata, Languages, and Programming (ICALP 2026),
LIPIcs vol. 374, article 81. Deterministic `O(m√log n + √(m n log n log log n))` SSSP
(`O(m√(log n log log n))` for sparse graphs), improving **[SSSP-2025]**.
DOI: 10.4230/LIPIcs.ICALP.2026.81.
Full version: arXiv:2602.07868.
https://drops.dagstuhl.de/storage/00lipics/lipics-vol374-icalp2026/html/LIPIcs.ICALP.2026.81/LIPIcs.ICALP.2026.81.html
https://arxiv.org/abs/2602.07868

## 12. Authorisation

This RFC authorises Phase 1 in `@totemsdk/omnia-router`: the bounded DP/BFS engine, parent-pointer
search results, validation, one-to-many inbound cross-token search with a global hop budget, the
internal engine/query/snapshot contracts, and benchmarks. It authorises no new package, no
distributed graph infrastructure, and no experimental algorithm as a production default.
