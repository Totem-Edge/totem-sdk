---
id: totem-community-node
title: Totem Community Node
sidebar_label: Totem Community Node
description: Finance infrastructure for cooperatives, schools, and markets with policy templates for merchant limits, relay permissions, and child-account rules.
---

# Totem Community Node

**Type:** Community finance infrastructure  
**Audience:** Cooperative operators, schools, local markets, community administrators

Totem Community Node is a shared Minima infrastructure deployment for a community — a cooperative, school, or local market. It runs a Lookup node, a real-time WebSocket server, and an Omnia router, stitched together with a policy layer that enforces merchant spend limits, relay permissions, and child-account rules.

---

## Packages used

| Package | Role in Totem Community Node |
|---------|------------------------------|
| `@totemsdk/lookup-node` | Community address registry — all members register here |
| `@totemsdk/lookup-client` | Member devices resolve addresses from the community node |
| `@totemsdk/lookup-protocol` | Wire protocol for member registration and queries |
| `@totemsdk/agent-policy` | Merchant limits, relay permissions, child-account rules |
| `@totemsdk/omnia-router` | Community routing node for off-chain member payments |
| `@totemsdk/realtime` | Real-time event push to member dashboards |
| `@totemsdk/pureminima-rpc` | Minima node RPC for balance queries and block events |
| `@totemsdk/chain-provider` | On-chain settlement for over-limit transactions |

---

## Core integration path

### 1. Start the community lookup node

```typescript
import { createLookupNode } from '@totemsdk/lookup-node';
import { LookupProtocol } from '@totemsdk/lookup-protocol';

const node = await createLookupNode({
  seed: COMMUNITY_NODE_SEED,
  port: 9001,
  protocol: new LookupProtocol({ version: 1 }),
  storage: communityStorage,
});

node.on('register', async (registration) => {
  const { address, publicKey, role } = registration;
  await communityRegistry.add({ address, publicKey, role });
  console.log(`Member registered: ${address} (${role})`);
});

await node.start();
```

### 2. Community policy templates

```typescript
import type { AgentPolicy, AgentProposal } from '@totemsdk/agent-policy';

const MERCHANT_DAILY_LIMIT = 500_000_000n;    // 500 MIN
const CHILD_DAILY_LIMIT    = 10_000_000n;     // 10 MIN

async function buildCommunityPolicy(memberId: string): Promise<AgentPolicy> {
  const member = await communityRegistry.get(memberId);

  return {
    async evaluate(proposal: AgentProposal) {
      const today = new Date().toDateString();
      const dailySpend = await getDailySpend(memberId, today);

      const limit = member.role === 'merchant'
        ? MERCHANT_DAILY_LIMIT
        : member.role === 'child'
          ? CHILD_DAILY_LIMIT
          : STANDARD_DAILY_LIMIT;

      const amount = BigInt(proposal.intent.amount ?? 0);

      if (dailySpend + amount > limit) {
        return {
          outcome: 'requires_human',
          prompt: `Daily limit for ${member.role} ${memberId} would be exceeded. Allow?`,
        };
      }

      // Relay permissions — only approved roles can run relay nodes
      if (proposal.intent.type === 'relay_register') {
        if (!['admin', 'merchant'].includes(member.role)) {
          return { outcome: 'rejected', reason: 'Only admins and merchants may run relay nodes' };
        }
      }

      return { outcome: 'approved', receipt: buildReceipt(proposal, `community-policy:${member.role}`) };
    },
  };
}
```

### 3. Real-time community dashboard

```typescript
import { createRealtimeServer } from '@totemsdk/realtime';
import { PureMinimaRPC } from '@totemsdk/pureminima-rpc';

const rtServer = createRealtimeServer({ port: 9004 });
const rpc = new PureMinimaRPC({ url: NODE_URL });

// Broadcast every payment touching a community address
rpc.on('NEWTXPOW', async (txpow) => {
  const communityAddresses = await communityRegistry.getAllAddresses();
  for (const addr of communityAddresses) {
    if (txpow.touches(addr)) {
      rtServer.broadcast(addr, { type: 'payment', txpow });
    }
  }
});

// Admin dashboard: community-wide stats
rtServer.on('subscribe:community-stats', async (ws) => {
  const stats = await computeCommunityStats();
  ws.send(JSON.stringify({ type: 'community-stats', stats }));
});
```

### 4. Member lookup from a device

```typescript
import { LookupClient } from '@totemsdk/lookup-client';

const client = new LookupClient({
  bootstrapPeers: [COMMUNITY_NODE_PEER_ID],
});

// Resolve "merchant-A" to a Minima address
const result = await client.resolve({ name: 'merchant-A', scope: 'community' });
console.log('Merchant address:', result.address);
```

---

## Future QVAC hook

:::tip Future QVAC hook
A QVAC agent can monitor community transaction patterns, automatically adjust daily limits based on seasonal demand (market days, school terms), generate community treasury reports, and flag unusual cross-member flows for cooperative review — all proposals filtered through the community policy layer.
:::

---

## API reference links

- [`@totemsdk/lookup-node`](/api/totemsdk-lookup-node)
- [`@totemsdk/lookup-client`](/api/totemsdk-lookup-client)
- [`@totemsdk/lookup-protocol`](/api/totemsdk-lookup-protocol)
- [`@totemsdk/agent-policy`](/api/totemsdk-agent-policy)
- [`@totemsdk/omnia-router`](/api/totemsdk-omnia-router)
- [`@totemsdk/realtime`](/api/totemsdk-realtime)
- [`@totemsdk/pureminima-rpc`](/api/totemsdk-pureminima-rpc)
- [`@totemsdk/chain-provider`](/api/totemsdk-chain-provider)
