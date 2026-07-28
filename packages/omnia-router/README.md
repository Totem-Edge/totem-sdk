# @totemsdk/omnia-router

**Multi-hop payments and cross-token swaps across the channel network.**

Builds an in-memory channel graph, finds optimal payment paths using Dijkstra/Bellman-Ford, and executes HTLC-chained multi-hop payments with atomic rollback on failure.

## Install

```bash
npm install @totemsdk/omnia-router
```

## What's inside

| Export | What it does |
|--------|-------------|
| `createChannelGraph()` | Create an in-memory routing topology |
| `addChannel(graph, channel)` / `removeChannel(graph, id)` | Maintain the graph |
| `findRoute(graph, from, to, amount)` | Dijkstra/Bellman-Ford path search over channel capacities and fees |
| `findCrossTokenRoute(graph, from, to, amount, tokenid)` | Find paths that include token swap intermediaries |
| `announceSwap(rate)` / `getSwapAnnouncements()` | Peers advertise exchange rates for cross-token routing |
| `executeMultiHopPayment(route, params)` | HTLC-chained execution; rolls back all HTLCs on any failure |
| `executeCrossTokenPayment(route, params)` | Multi-hop with a token swap at an intermediate node |
| `cancelPayment(paymentId)` | Cancel an in-flight payment and release all HTLCs |
| `buildPaymentRequest(params)` | Structured payment URI |
| `buildCrossTokenRequest(params)` | Structured cross-token payment URI |

## Usage

### Build a routing graph and find a path

```typescript
import { createChannelGraph, addChannel, findRoute } from '@totemsdk/omnia-router';

const graph = createChannelGraph();

// Add all known channels (typically from lookup-node discovery)
for (const channel of myChannels) {
  addChannel(graph, channel);
}

const route = findRoute(graph, 'MxAAA...', 'MxZZZ...', '25');
if (!route) {
  throw new Error('No route found');
}

console.log('Hops:', route.hops.map(h => h.channel.id));
console.log('Total fees:', route.totalFees);
```

### Execute a multi-hop payment

```typescript
import { executeMultiHopPayment } from '@totemsdk/omnia-router';

const result = await executeMultiHopPayment(route, {
  signer,
  preimage: crypto.getRandomValues(new Uint8Array(32)),
});

if (result.success) {
  console.log('Payment delivered, preimage:', result.preimage);
}
```

### Cross-token swap payment

```typescript
import { findCrossTokenRoute, executeCrossTokenPayment } from '@totemsdk/omnia-router';

// Find a path that swaps MIN → MYTOKEN at an intermediate node
const route = findCrossTokenRoute(graph, 'MxAAA...', 'MxZZZ...', '10', 'MYTOKEN_ID');
await executeCrossTokenPayment(route, { signer });
```

### Advertise a swap rate

```typescript
import { announceSwap } from '@totemsdk/omnia-router';

// Tell the network you'll swap MIN ↔ MYTOKEN at a given rate
await announceSwap({
  fromToken: '0x00',
  toToken: 'MYTOKEN_ID',
  rate: '100', // 1 MYTOKEN = 100 MIN
  maxAmount: '500',
});
```

## See also

- [`@totemsdk/omnia`](https://www.npmjs.com/package/@totemsdk/omnia) — channel state machine powering each hop
- [`@totemsdk/omnia-factory`](https://www.npmjs.com/package/@totemsdk/omnia-factory) — factory channels included in the routing graph
- [`@totemsdk/omnia`](https://www.npmjs.com/package/@totemsdk/omnia) — Omnia messaging layer for propagating routes
- [`@totemsdk/lookup-node`](https://www.npmjs.com/package/@totemsdk/lookup-node) — peer discovery for channel graph construction
