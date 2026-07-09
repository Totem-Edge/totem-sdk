---
id: wots-key-management
title: WOTS Key Management
sidebar_label: WOTS Key Management
description: How the Totem SDK manages quantum-resistant one-time signing keys across addresses.
---

# WOTS Key Management

Totem uses **Winternitz One-Time Signatures (WOTS)** — the same quantum-resistant scheme used by Minima. Each signing key can only be used once safely. The SDK manages key lifecycles so you never accidentally reuse a key.

## Per-address TreeKey architecture

Each wallet address has its own independent 3-level TreeKey (size=64, depth=3):

```
Seed phrase
  └─ Address 0 TreeKey (base seed + index 0)
       ├─ L1 keys [0..63]
       │    └─ L2 keys [0..63]  ← leaf signing keys (4,096 total per address)
  └─ Address 1 TreeKey (base seed + index 1)
  └─ ... up to 64 addresses
```

A signature path is `(addressIndex, l1, l2)`. Once a `(l1, l2)` pair is used at a given address index, it must never be reused.

## WatermarkStore

`WatermarkStore` from `@totemsdk/core` tracks the high-water mark of used indices:

```typescript
import { WatermarkStore } from '@totemsdk/core';

const store = new WatermarkStore(storage, logger);
await store.initialize();

const indices = store.getNextIndices(); // { addressIndex, l1, l2 }
await store.markUsed(indices);
await store.advanceWatermark(indices);
```

## LeaseStore and LeaseMonitor

Use `LeaseStore` to persist lease metadata and `LeaseMonitor` for expiry callbacks:

```typescript
import { LeaseStore, LeaseMonitor } from '@totemsdk/core';

const leaseStore = new LeaseStore(storage, logger);
const monitor = new LeaseMonitor(leaseStore, timer, logger, {
  defaultIntervalMs: 5_000,
  expiryThresholdMs: 30_000,
});

monitor.onExpirySoon(({ leaseId, remainingMs }) => {
  console.warn(`Lease ${leaseId} expires in ${remainingMs}ms — renew now`);
});

monitor.start();
```

## See also

- [`@totemsdk/core` API reference](/api/totemsdk-core)
- [`@totemsdk/wots-lease` API reference](/api/totemsdk-wots-lease)
- [TESSA Pay guide](/guides/tessa-pay)
