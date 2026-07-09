---
id: omnia-vtxo
title: Omnia VTXO — Virtual UTXO Claim Layer
sidebar_label: Omnia VTXO
description: How the @totemsdk/omnia-vtxo package provides cash-like off-chain balances backed by Merkle commitment trees.
---

# Omnia VTXO — Virtual UTXO Claim Layer

**`@totemsdk/omnia-vtxo`** is a cash-like off-chain balance primitive that gives Totem Edge applications a way to hold, transfer, split, merge, and exit token balances without requiring a live Minima node for every operation.

Each VTXO (Virtual Transaction Output) is a claim on a pool of on-chain capacity, backed by a deterministic Merkle commitment tree. Think of it as a **bearer note inside a shared liquidity pool**: the pool operator holds the on-chain UTXO; the holder holds the VTXO proof.

---

## How VTXOs differ from Statechains

Both VTXOs and Statechains are off-chain ownership primitives, but they are designed for different use cases:

| | Statechain | Omnia VTXO |
|---|---|---|
| Ownership transfer | Blind SE co-signature | Pure functional, no live signing needed |
| Privacy model | Blind Mercury SE | Local commitment root |
| Splitting | Not supported | Supported natively |
| Merging | Not supported | Supported natively |
| Exit model | On-chain UTXO handoff | Pool epoch settlement |
| Use case | Privacy UTXO custody | Merchant receipts, credits, pool liquidity |

---

## The pool model

A **pool** is the on-chain anchor that backs a set of VTXOs. Pools are created by an operator and hold a fixed `totalCapacity`. Minting a VTXO reduces the pool's `availableCapacity`. Exiting a VTXO returns capacity to the chain.

```typescript
import { createPool } from '@totemsdk/omnia-vtxo';

const pool = createPool({
  operator: 'MxOperatorAddress',
  tokenId: '0x00',              // Minima native token
  totalCapacity: BigInt(1_000_000_000),
  nonce: 'pool-genesis-v1',     // makes poolId deterministic
}, Date.now());
// pool.poolId is SHA3-256(operator + tokenId + nonce) — always deterministic
```

| Field | Description |
|-------|-------------|
| `poolId` | Deterministic hash — never changes |
| `operator` | Minima address holding the on-chain backing UTXO |
| `tokenId` | Token this pool holds |
| `totalCapacity` | Total token units the pool can back |
| `availableCapacity` | Remaining mintable capacity |
| `epoch` | Advances on each batch refresh round |
| `commitmentRoot` | Current Merkle root over all live VTXOs |

---

## Full operation lifecycle

### 1. Mint

Creates a new VTXO, reducing `pool.availableCapacity`.

```typescript
import { mintVtxo } from '@totemsdk/omnia-vtxo';

const { pool: p1, vtxo: note, receipt } = mintVtxo(
  pool,
  { owner: 'MxAlice', amount: BigInt(100_000), nonce: 'note-1' },
  Date.now(),
);
// note.status === 'active'
```

### 2. Transfer

Moves a VTXO to a new owner. Full transfer marks the input as `transferred` and creates a new `active` output.

```typescript
import { transferVtxo } from '@totemsdk/omnia-vtxo';

const { input: spent, output: bobNote, transfer } = transferVtxo(
  note,
  { recipient: 'MxBob', amount: BigInt(100_000), nonce: 'tx-1' },
  Date.now(),
);
// spent.status === 'transferred', bobNote.status === 'active'
```

### 3. Split

Divides one VTXO into two or more pieces. The input becomes `split`; all outputs are `active`.

```typescript
import { splitVtxo } from '@totemsdk/omnia-vtxo';

const { input: splitInput, outputs: [piece1, piece2] } = splitVtxo(
  bobNote,
  { amounts: [BigInt(60_000), BigInt(40_000)], nonces: ['sp-1', 'sp-2'] },
  Date.now(),
);
// piece1.amount + piece2.amount must equal bobNote.amount
```

### 4. Merge

Combines multiple VTXOs into one. Inputs become `merged`; the output is `active`. All inputs must belong to the same pool and token.

```typescript
import { mergeVtxos } from '@totemsdk/omnia-vtxo';

const { output: mergedNote } = mergeVtxos(
  [piece1, piece2],
  { nonce: 'mg-1', owner: 'MxBob' },
  Date.now(),
);
```

### 5. Refresh

Re-anchors a VTXO against a new pool epoch. The old VTXO becomes `refreshed`; the new one is `active` with a higher epoch number.

```typescript
import { refreshVtxo } from '@totemsdk/omnia-vtxo';

const { old: staleNote, refreshed: freshNote } = refreshVtxo(
  mergedNote,
  { newEpoch: 1, nonce: 'ref-1' },
  Date.now(),
);
```

### 6. Exit

Initiates and finalises a unilateral exit, returning the VTXO's value to the on-chain pool.

```typescript
import { createExitDraft, markExiting, markExited } from '@totemsdk/omnia-vtxo';

const { draft, receipt: exitReceipt } = createExitDraft(freshNote, Date.now());
// draft.draftType === 'mock-exit' (see Security Notes below)
```

---

## `VtxoStatus` state machine

Every VTXO moves through the following states. Terminal states are `transferred`, `split`, `merged`, `refreshed`, `spent`, and `exited`.

```
        ┌──────── mint ────────┐
        ▼                     │
     active ──transfer──► transferred
        │
        ├─ partial-transfer ──► split  (input)
        │                       │
        ├─ split ────────────► split  (input)
        │
        ├─ merge ────────────► merged (inputs)
        │
        ├─ refresh ──────────► refreshed (old)
        │
        ├─ exit_initiated ───► exiting
        │                         │
        │                      exited
        └─ spent ──────────── spent
```

---

## Verification and conservation

```typescript
import { verifyVtxo, verifyConservation } from '@totemsdk/omnia-vtxo';

// Verify a single VTXO's proof fields
const check = verifyVtxo(freshNote);
console.log('Valid:', check.valid);

// Verify balance conservation across an operation
const conservation = verifyConservation({
  inputs: [note],
  outputs: [bobNote],  // sum(inputs) must equal sum(outputs)
});
console.log('Conservation holds:', conservation.valid);
```

---

## Error hierarchy

All errors extend `OmniaVtxoError` and carry a structured `code` string:

```
OmniaVtxoError
  ├── VtxoAmountError       — invalid amounts (zero, overflow, sum mismatch)
  ├── VtxoStatusError       — wrong status for the requested operation
  ├── VtxoOwnershipError    — owner mismatch
  ├── VtxoProofError        — Merkle proof verification failure
  ├── VtxoPoolCapacityError — insufficient pool capacity
  ├── VtxoPolicyError       — policy violation (min/max amounts, epoch ordering)
  ├── VtxoMergeError        — merge precondition failure (cross-pool, duplicates)
  ├── VtxoSplitError        — split precondition failure
  └── VtxoExitError         — exit precondition failure
```

---

## Persistence

`OmniaVtxoStore` is a simple async interface. `MemoryOmniaVtxoStore` ships as the in-memory MVP implementation.

```typescript
import { MemoryOmniaVtxoStore } from '@totemsdk/omnia-vtxo';

const store = new MemoryOmniaVtxoStore();
await store.savePool(pool);
await store.saveVtxo(freshNote);
const loaded = await store.getVtxo(freshNote.vtxoId);
const all    = await store.listVtxos(pool.poolId);
```

---

## Serialization

`serializeVtxo` / `deserializeVtxo` produce BigInt-safe JSON strings (BigInt values are encoded as `"__bigint__:<value>"`).

```typescript
import { serializeVtxo, deserializeVtxo, serializePool, deserializePool } from '@totemsdk/omnia-vtxo';

const json = serializeVtxo(freshNote);
const restored = deserializeVtxo(json);
```

---

## Security notes / MVP caveats

> **This is an MVP SDK — not a production Ark implementation.**

Several components are stubs awaiting production hardening:

- **Operator receipts** use `MOCK_OPERATOR_SIGNATURE`. In production the operator signs over the commitment root with a real WOTS or Schnorr key, and clients must verify against the operator's published public key.
- **Commitment roots** are single-batch local roots, not pool-wide epoch roots. A full deployment requires the operator to broadcast a pool-wide root each epoch.
- **Exit scripts** use `draftType: 'mock-exit'`. Real exits require audited KISSVM covenant exit scripts and a watchtower monitoring the on-chain dispute window.
- **No watchtower / dispute monitoring.** Operator equivocation is not detected.
- **No replay protection beyond nonce uniqueness.** Nonces must be globally unique per pool.

---

## Future roadmap

- **Real Omnia factory backing** — pool funds held in an N-of-N Omnia factory UTXO with batch settlement on exit.
- **Batch refresh rounds** — operator posts a new commitment root; all live VTXOs refreshed in a single Minima transaction.
- **Operator signing** — real WOTS receipts replacing `MOCK_OPERATOR_SIGNATURE`, with client-side signature verification.
- **Wallet integration** — direct integration with Totem Wallet's coin selection and WOTS signing infrastructure.
- **Connect API methods** — `totem_mintVtxo`, `totem_transferVtxo`, `totem_listVtxos` via the TOTEM_CONNECT dApp API.
- **Persistence adapters** — PostgreSQL and IndexedDB adapters for `OmniaVtxoStore`.
- **KISSVM exit script** — audited on-chain exit covenant for unilateral exit with timelock enforcement.

---

## See also

- [`@totemsdk/omnia-vtxo` API reference](/api/totemsdk-omnia-vtxo)
- [Omnia Payment Channels](/concepts/omnia-channels) — the eltoo channel layer that backs pool funds
- [`@totemsdk/statechain` API reference](/api/totemsdk-statechain) — alternative off-chain ownership primitive
