---
id: totem-personal-node
title: Totem Personal Node
sidebar_label: Totem Personal Node
description: Always-on personal node for multi-device coordination with shared WOTS lease strategy.
---

# Totem Personal Node

**Type:** Personal infrastructure node  
**Audience:** Power users, self-sovereign builders, multi-device wallet operators

Totem Personal Node keeps a Minima node running 24/7 on behalf of a single user, synchronising WOTS key state and spend policies across all of that user's devices. It is the foundation for any application that needs always-available address resolution or multi-device signing coordination.

---

## Packages used

| Package | Role in Totem Personal Node |
|---------|----------------------------|
| `@totemsdk/lookup-node` | Runs the Hyperswarm-based address lookup node |
| `@totemsdk/lookup-protocol` | Wire protocol for address announcements and queries |
| `@totemsdk/agent-policy` | Governs which spend requests are auto-approved vs. queued |
| `@totemsdk/pureminima-rpc` | Low-level RPC for block sync and UTXO queries |
| `@totemsdk/chain-provider` | High-level abstraction over the local Minima node |
| `@totemsdk/wots-lease` | Shared WOTS lease strategy — one lease shared across devices |
| `@totemsdk/realtime` | Real-time push of new TxPoW events to connected devices |

---

## Core integration path

### 1. Start the lookup node

```typescript
import { createLookupNode } from '@totemsdk/lookup-node';

const node = await createLookupNode({
  seed: process.env.NODE_SEED!,
  port: 9001,
  announceInterval: 30_000,
});

node.on('query', async (query) => {
  const result = await resolveFromLocalIndex(query.address);
  return result;
});

await node.start();
console.log('Lookup node running, peer ID:', node.peerId);
```

### 2. Register addresses on the lookup network

```typescript
import { LookupClient } from '@totemsdk/lookup-client';

const client = new LookupClient({ bootstrapPeers: BOOTSTRAP_NODES });

// Announce all wallet addresses to the lookup network
for (const account of wallet.getAccounts()) {
  await client.announce({
    address: account.address,
    publicKey: account.publicKey,
    nodeId: node.peerId,
  });
}
```

### 3. Shared WOTS lease for multi-device signing

```typescript
import { createSharedLeaseStrategy } from '@totemsdk/wots-lease';

// One lease shared across all devices — prevents index reuse
const leaseStrategy = createSharedLeaseStrategy({
  storageKey: `personal-node:${userId}:wots-lease`,
  storage: encryptedStorage,
  maxSignaturesPerLease: 100,
  renewThreshold: 0.8, // Renew when 80% used
});

const signer = await leaseStrategy.getSigner();
```

### 4. Personal spend policy

```typescript
import type { AgentPolicy, AgentProposal } from '@totemsdk/agent-policy';

const personalPolicy: AgentPolicy = {
  async evaluate(proposal: AgentProposal) {
    // Always auto-approve from known trusted devices
    if (TRUSTED_DEVICE_IDS.has(proposal.requestedBy.id)) {
      return {
        outcome: 'approved',
        receipt: buildReceipt(proposal, 'trusted-device'),
      };
    }

    // Queue unknown devices for manual confirmation
    return {
      outcome: 'requires_human',
      prompt: `Unknown device ${proposal.requestedBy.id} wants to spend ${proposal.intent.amount} MIN`,
    };
  },
};
```

### 5. Real-time sync to connected devices

```typescript
import { createRealtimeServer } from '@totemsdk/realtime';

const rtServer = createRealtimeServer({ port: 9004 });

// Push every new TxPoW that touches a watched address
rpc.on('NEWTXPOW', (txpow) => {
  const touchedAddresses = extractTouchedAddresses(txpow);
  for (const addr of touchedAddresses) {
    rtServer.broadcast(addr, { type: 'newtxpow', txpow });
  }
});
```

---

## Future QVAC hook

:::tip Future QVAC hook
A QVAC agent attached to a personal node can auto-rebalance channel liquidity, monitor for unusual spend patterns and self-impose temporary rate limits, and auto-renew WOTS leases before exhaustion — all without any key exposure. The `personalPolicy` evaluator is the exact insertion point.
:::

---

## API reference links

- [`@totemsdk/lookup-node`](/api/totemsdk-lookup-node)
- [`@totemsdk/lookup-protocol`](/api/totemsdk-lookup-protocol)
- [`@totemsdk/agent-policy`](/api/totemsdk-agent-policy)
- [`@totemsdk/pureminima-rpc`](/api/totemsdk-pureminima-rpc)
- [`@totemsdk/chain-provider`](/api/totemsdk-chain-provider)
- [`@totemsdk/wots-lease`](/api/totemsdk-wots-lease)
- [`@totemsdk/realtime`](/api/totemsdk-realtime)
