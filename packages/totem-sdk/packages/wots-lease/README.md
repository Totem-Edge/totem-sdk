# @totemsdk/wots-lease

**WOTS key safety — prevents catastrophic signature slot reuse.**

> ⚠️ **WOTS keys are one-time use.** Reusing a signing slot leaks the private key and permanently destroys the security of that address. This package is the guardian that prevents it from happening.

Coordinates key-use watermarks across devices and sessions so no signing slot is ever allocated twice.

## Install

```bash
npm install @totemsdk/wots-lease
```

## What's inside

### Core stores

| Class | What it does |
|-------|-------------|
| `WotsWatermarkStore` | Canonical v3 watermark tracking; `flatIndex` maps `(l1, l2)` → flat slot number |
| `LeaseJournal` | Append-only audit log of every signing slot allocation |

### Provider tiers

| Provider | Use case |
|----------|----------|
| `LocalLeaseProvider` | Single-device, in-process coordination |
| `AxiaLeaseProvider` | Cloud-coordinated leases via Axia API |
| `HybridLeaseProvider` | Local-first with Axia sync fallback |
| `PersonalLeaseNodeProvider` | Coordinates through your personal lookup node *(ready for implementation)* |
| `P2PQuorumLeaseProvider` | Multi-device quorum consensus *(stub)* |
| `OnchainWatermarkProvider` | On-chain watermark anchoring *(stub)* |

### Device range splitting

```typescript
import { allocateDeviceRange } from '@totemsdk/wots-lease';

// Split 262,144 signing slots across 4 devices without overlap
const range = allocateDeviceRange({ deviceIndex: 0, totalDevices: 4 });
// { start: 0, end: 65535 }
```

### Error types

| Error | Meaning |
|-------|---------|
| `WatermarkMonotonicityError` | Attempted to use a slot at or before the current watermark |
| `WatermarkExhaustedError` | All 262,144 signing slots for this address have been used |
| `DeviceRangeViolationError` | Slot is outside this device's allocated range |

## Usage

### Local (single device)

```typescript
import { LocalLeaseProvider, WotsWatermarkStore } from '@totemsdk/wots-lease';

const store    = new WotsWatermarkStore(storageAdapter);
const provider = new LocalLeaseProvider(store);

// Allocate the next available signing slot
const slot = await provider.allocateSlot({ addressIndex: 0 });
console.log('Use flat slot:', slot.flatIndex); // e.g. 42

// After signing, commit the watermark
await provider.commitSlot(slot);
```

### Hybrid (local + Axia cloud backup)

```typescript
import { HybridLeaseProvider } from '@totemsdk/wots-lease';

const provider = new HybridLeaseProvider({
  local: new LocalLeaseProvider(store),
  remote: new AxiaLeaseProvider({ baseUrl: 'https://api.axia.to', projectId: '...' }),
  syncIntervalMs: 60_000,
});
```

### Audit log

```typescript
import { LeaseJournal } from '@totemsdk/wots-lease';

const journal = new LeaseJournal(storageAdapter);
const entries = await journal.getEntries({ addressIndex: 0 });
entries.forEach(e => console.log(e.flatIndex, e.allocatedAt, e.committedAt));
```

## See also

- [`@totemsdk/core`](https://www.npmjs.com/package/@totemsdk/core) — WOTS primitives this package protects
- [`@totemsdk/lookup-node`](https://www.npmjs.com/package/@totemsdk/lookup-node) — `LeaseCoordinator` for multi-client setups
- [`@totemsdk/omnia`](https://www.npmjs.com/package/@totemsdk/omnia) — integrates wots-lease to protect channel signing slots
