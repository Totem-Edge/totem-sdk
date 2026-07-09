---
id: omnia-channels
title: Omnia Payment Channels
sidebar_label: Omnia Channels
description: How Omnia Layer 2 eltoo channels work in the Totem SDK.
---

# Omnia Payment Channels

**Omnia** is Minima's Layer 2 protocol based on **eltoo** — a scheme for replaceable state updates. Instead of punishing old states (like Lightning), eltoo simply allows the latest signed state to replace any earlier one on-chain.

## Core concepts

| Term | Meaning |
|------|---------|
| **Channel** | A 2-of-2 MULTISIG WOTS covenant between two parties |
| **State update** | A new balance split signed by both parties, replacing the prior state |
| **Settlement** | Broadcasting the latest agreed state to the Minima chain |
| **HTLC** | Hash Time-Locked Contract — enables multi-hop routing across channels |

## Channel lifecycle

```
open() → fund() → [update() ...] → cooperativeClose() | forceClose()
```

```typescript
import { openChannel, updateChannel, closeChannel } from '@totemsdk/omnia';

// Open with 100 MIN capacity
const channel = await openChannel({
  counterparty: peerPublicKey,
  localAmount: 50_000_000n,  // satoshi units
  remoteAmount: 50_000_000n,
  chainProvider,
  wotsLease,
});

// Update balance: send 10 MIN to counterparty
const updated = await updateChannel(channel, {
  localDelta: -10_000_000n,
});

// Cooperatively close
await closeChannel(channel, { cooperative: true });
```

## Package family

| Package | Role |
|---------|------|
| `@totemsdk/omnia` | Core state machine |
| `@totemsdk/omnia-factory` | N-of-N group channel creation |
| `@totemsdk/omnia-router` | Multi-hop pathfinding and fee logic |
| `@totemsdk/omnia-splice` | Resize a channel without closing |
| `@totemsdk/omnia-hyperswarm` | Peer discovery and wire transport |
| [`@totemsdk/omnia-vtxo`](/concepts/omnia-vtxo) | Virtual UTXO claim layer — cash-like off-chain balances backed by Merkle commitment trees |

## See also

- [Omnia Pocket guide](/guides/omnia-pocket) — mobile payment wallet
- [Omnia Router Node guide](/guides/omnia-router-node) — routing infrastructure
- [Channel Factory Wallet guide](/guides/channel-factory-wallet) — group channels
- [Omnia VTXO concept](/concepts/omnia-vtxo) — cash-like bearer notes backed by pool capacity
