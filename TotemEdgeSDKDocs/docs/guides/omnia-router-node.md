---
id: omnia-router-node
title: Omnia Router Node
sidebar_label: Omnia Router Node
description: Liquidity and payment-routing node with policy-controlled accepted routes, fee floors, and cross-token swap rules.
---

# Omnia Router Node

**Type:** Routing infrastructure  
**Audience:** Liquidity providers, infrastructure operators, exchange builders

The Omnia Router Node is a professional routing node that forwards multi-hop Omnia channel payments. It earns routing fees and acts as a bridge between different parts of the Minima payment-channel network. Policy controls which routes are accepted, minimum fee floors, and rules for cross-token atomic swaps.

---

## Packages used

| Package | Role in Omnia Router Node |
|---------|--------------------------|
| `@totemsdk/omnia-router` | Multi-hop pathfinding, HTLC forwarding, fee computation |
| `@totemsdk/omnia` | Underlying channel state machine |
| `@totemsdk/omnia-hyperswarm` | Peer connectivity and route advertisement |
| `@totemsdk/agent-policy` | Route acceptance, fee floor, swap rule enforcement |
| `@totemsdk/lookup-node` | Registers this router in the lookup network |
| `@totemsdk/pear` | Optional Pear runtime for desktop deployment |
| `@totemsdk/chain-provider` | On-chain settlement for HTLCs that time out |

---

## Core integration path

### 1. Initialise the router

```typescript
import { createOmniaRouter } from '@totemsdk/omnia-router';
import { HyperswarmTransport } from '@totemsdk/omnia-hyperswarm';

const transport = new HyperswarmTransport({ topic: 'omnia-router-mainnet' });

const router = await createOmniaRouter({
  nodeKey: ROUTER_SECRET_KEY,
  transport,
  chainProvider,
  feePolicy: {
    baseFeeMin: 1n,          // 1 satoshi minimum
    proportionalFee: 0.001,  // 0.1% of forwarded amount
  },
});

await router.start();
console.log('Router public key:', router.publicKey);
```

### 2. Build the channel graph

```typescript
import { buildChannelGraph, findBestPath } from '@totemsdk/omnia-router';

// Channels are discovered from peers automatically via Hyperswarm
const graph = await buildChannelGraph(router);

// Find the best path for a 5 MIN payment
const path = await findBestPath(graph, {
  from: senderAddress,
  to: recipientAddress,
  amount: 5_000_000n,
  maxHops: 4,
});

console.log('Path:', path.hops.map(h => h.nodeId).join(' → '));
console.log('Total fee:', path.totalFee, 'satoshis');
```

### 3. Router policy: route acceptance and fee floors

```typescript
import type { AgentPolicy, AgentProposal } from '@totemsdk/agent-policy';

const BLOCKED_COUNTERPARTIES = new Set<string>([/* sanctioned keys */]);
const MIN_FEE_SATOSHIS = 100n;

const routerPolicy: AgentPolicy = {
  async evaluate(proposal: AgentProposal) {
    const { intent } = proposal;

    if (intent.type !== 'route_forward') {
      return { outcome: 'rejected', reason: 'Only route_forward intents accepted' };
    }

    // Check counterparty blocklist
    if (BLOCKED_COUNTERPARTIES.has(intent.nextHop)) {
      return { outcome: 'rejected', reason: 'Counterparty is on the blocklist' };
    }

    // Enforce fee floor
    if (BigInt(intent.fee) < MIN_FEE_SATOSHIS) {
      return { outcome: 'rejected', reason: `Fee ${intent.fee} is below floor ${MIN_FEE_SATOSHIS}` };
    }

    // Cross-token swaps require human approval
    if (intent.inTokenId !== intent.outTokenId) {
      return {
        outcome: 'requires_human',
        prompt: `Approve cross-token swap: ${intent.inTokenId} → ${intent.outTokenId}, amount ${intent.amount}?`,
      };
    }

    return { outcome: 'approved', receipt: buildReceipt(proposal, 'router-policy-v1') };
  },
};
```

### 4. Forward a payment

```typescript
import { forwardPayment } from '@totemsdk/omnia-router';

router.onForwardRequest(async (request) => {
  const proposal = buildProposal('route_forward', {
    nextHop: request.nextHop,
    amount: request.amount,
    fee: request.fee,
    inTokenId: request.inTokenId,
    outTokenId: request.outTokenId,
  });

  const decision = await routerPolicy.evaluate(proposal);
  if (decision.outcome !== 'approved') {
    return request.reject(decision.outcome === 'rejected' ? decision.reason : 'awaiting_confirmation');
  }

  return forwardPayment(router, request);
});
```

---

## Future QVAC hook

:::tip Future QVAC hook
A QVAC agent can dynamically adjust fee floors based on network congestion, rebalance channels proactively to maintain routing capacity, detect fee sniping patterns and temporarily raise floors, and report routing revenue metrics to an external analytics system — all as proposals evaluated by `routerPolicy`.
:::

---

## API reference links

- [`@totemsdk/omnia-router`](/api/totemsdk-omnia-router)
- [`@totemsdk/omnia`](/api/totemsdk-omnia)
- [`@totemsdk/omnia-hyperswarm`](/api/totemsdk-omnia-hyperswarm)
- [`@totemsdk/agent-policy`](/api/totemsdk-agent-policy)
- [`@totemsdk/lookup-node`](/api/totemsdk-lookup-node)
- [`@totemsdk/pear`](/api/totemsdk-pear)
- [`@totemsdk/chain-provider`](/api/totemsdk-chain-provider)
