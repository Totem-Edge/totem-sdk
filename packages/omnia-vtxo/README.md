# `@totemsdk/omnia-vtxo`

Virtual UTXO (vTXO) / payment-pool claim layer for the Totem Edge ecosystem.

## What is Omnia VTXO?

`@totemsdk/omnia-vtxo` is a **cash-like off-chain balance primitive** that gives Totem Edge applications a way to hold, transfer, split, merge, and exit token balances without requiring a live Minima node for every operation. Each VTXO (Virtual Transaction Output) is a claim on a pool of on-chain capacity, backed by a deterministic Merkle commitment tree.

Think of it as a bearer note inside a shared liquidity pool. The pool operator holds the on-chain UTXO; the holder holds the VTXO proof.

### How it differs from Statechains

| | Statechain | Omnia VTXO |
|---|---|---|
| Ownership transfer | Blind SE co-signature | Pure functional, no live signing needed |
| Privacy model | Blind Mercury SE | Local commitment root |
| Splitting | Not supported | Supported natively |
| Merging | Not supported | Supported natively |
| Exit model | On-chain UTXO handoff | Pool epoch settlement |
| Use case | Privacy UTXO custody | Merchant receipts, credits, pool liquidity |

### Relation to other `@totemsdk` packages

```
@totemsdk/omnia              ← L2 channel layer (eltoo state machine)
@totemsdk/omnia-factory      ← N-of-N funding factory
@totemsdk/omnia-vtxo         ← Virtual UTXO claim layer (this package)
@totemsdk/statechain         ← Mercury off-chain ownership records
```

## Install

```bash
pnpm add @totemsdk/omnia-vtxo @noble/hashes
```

## Import

```ts
import {
  createPool,
  mintVtxo,
  transferVtxo,
  splitVtxo,
  mergeVtxos,
  refreshVtxo,
  createExitDraft,
  verifyVtxo,
  verifyConservation,
  MemoryOmniaVtxoStore,
  serializeVtxo,
  deserializeVtxo,
} from '@totemsdk/omnia-vtxo';
```

## Full Lifecycle Example

```ts
import {
  createPool,
  mintVtxo,
  transferVtxo,
  splitVtxo,
  mergeVtxos,
  refreshVtxo,
  createExitDraft,
  markExiting,
  markExited,
  verifyVtxo,
  verifyConservation,
  MemoryOmniaVtxoStore,
} from '@totemsdk/omnia-vtxo';

const NOW = Date.now();

// 1. Create a pool (deterministic — poolId derived from operator + tokenId + nonce)
const pool = createPool({
  operator: 'MxOperatorAddress',
  tokenId: '0x00',         // Minima native token
  totalCapacity: BigInt(1_000_000_000),
  nonce: 'pool-genesis-v1',
}, NOW);

// 2. Mint a VTXO (reduces pool.availableCapacity)
const { pool: p1, vtxo: note, receipt: mintReceipt } = mintVtxo(
  pool,
  { owner: 'MxAlice', amount: BigInt(100_000), nonce: 'note-1' },
  NOW,
);

// 3. Transfer the note to Bob (full transfer: note → transferred, bobNote → active)
const { input: spentNote, output: bobNote, transfer } = transferVtxo(
  note,
  { recipient: 'MxBob', amount: BigInt(100_000), nonce: 'tx-1' },
  NOW + 1,
);

// 4. Split Bob's note into two pieces
const { input: splitInput, outputs: [piece1, piece2] } = splitVtxo(
  bobNote,
  { amounts: [BigInt(60_000), BigInt(40_000)], nonces: ['sp-1', 'sp-2'] },
  NOW + 2,
);

// 5. Merge the two pieces back together
const { output: mergedNote } = mergeVtxos(
  [piece1, piece2],
  { nonce: 'mg-1', owner: 'MxBob' },
  NOW + 3,
);

// 6. Refresh the note to a new epoch (re-anchor against pool epoch)
const { old: staleNote, refreshed: freshNote } = refreshVtxo(
  mergedNote,
  { newEpoch: 1, nonce: 'ref-1' },
  NOW + 4,
);

// 7. Create a mock exit draft
const { draft, receipt: exitReceipt } = createExitDraft(freshNote, NOW + 5);
console.log('Exit draft type:', draft.draftType); // 'mock-exit'

// 8. Verify proofs and conservation
const vtxoCheck = verifyVtxo(freshNote);
console.log('VTXO valid:', vtxoCheck.valid);

const conservation = verifyConservation({
  inputs: [note],
  outputs: [spentNote],   // full transfer: input sum must equal output sum
});

// 9. Persist with MemoryOmniaVtxoStore
const store = new MemoryOmniaVtxoStore();
await store.savePool(p1);
await store.saveVtxo(freshNote);
const loaded = await store.getVtxo(freshNote.vtxoId);
```

## API Reference

### Pool

| Function | Description |
|---|---|
| `createPool(params, now)` | Creates a new VTXO pool. `poolId` is deterministic from `operator + tokenId + nonce`. Never calls `Date.now()` internally. |
| `assertPoolCanMint(pool, amount)` | Validates capacity and policy. Throws `VtxoPoolCapacityError` or `VtxoPolicyError`. |
| `updatePoolRoot(pool, root)` | Returns a new pool with an updated commitment root (immutable). |
| `advancePoolEpoch(pool, newEpoch)` | Advances epoch; throws if `newEpoch <= pool.epoch`. |

### VTXO Lifecycle

| Function | Status transition | Notes |
|---|---|---|
| `mintVtxo(pool, params, now)` | — → `active` | Reduces `pool.availableCapacity`. |
| `transferVtxo(vtxo, params, now)` | `active` → `transferred`/`split` | Full: input `transferred`, output `active`. Partial: input `split`, output+change `active`. |
| `splitVtxo(vtxo, params, now)` | `active` → `split` | Outputs `active`. Sum must equal input amount. |
| `mergeVtxos(vtxos, params, now)` | `active[]` → `merged` | Output `active`. Rejects duplicate IDs. Same pool+token required. |
| `refreshVtxo(vtxo, params, now)` | `active` → `refreshed` | New VTXO `active` with higher epoch. |
| `markExiting(vtxo, now)` | `active` → `exiting` | Initiates unilateral exit. |
| `markExited(vtxo, now)` | `exiting` → `exited` | Finalises exit. |
| `createExitDraft(vtxo, now)` | — | Returns `draftType: 'mock-exit'` and a receipt. |
| `markVtxoSpent(vtxo, now)` | `active` → `spent` | Direct spend (used by operator settlement). |

### Verification & Conservation

```ts
verifyVtxo(vtxo)                          // validate fields + proof
verifyVtxoProof(vtxo, proof)              // verify Merkle path
verifyVtxoTransfer(input, output, tx)     // validate transfer struct
verifyConservation({ inputs, outputs })   // sum(inputs) must equal sum(outputs)
```

### Serialization (BigInt-safe)

```ts
serializeVtxo(vtxo)    // → JSON string (BigInt serialized as "__bigint__:<value>")
deserializeVtxo(json)  // → OmniaVtxo (BigInt restored)
serializePool(pool)    // → JSON string
deserializePool(json)  // → OmniaVtxoPool
```

### Store Interface

`OmniaVtxoStore` is a simple async interface:

```ts
interface OmniaVtxoStore {
  savePool(pool): Promise<void>;
  getPool(poolId): Promise<OmniaVtxoPool | undefined>;
  saveVtxo(vtxo): Promise<void>;
  getVtxo(vtxoId): Promise<OmniaVtxo | undefined>;
  listVtxos(poolId?): Promise<OmniaVtxo[]>;
  markVtxoSpent(vtxoId, now?): Promise<void>;
}
```

`MemoryOmniaVtxoStore` ships as the in-memory MVP implementation.

### Policy Helpers

```ts
buildVtxoTransferIntent(vtxo, recipient, amount, nonce, changeNonce?)
buildVtxoExitIntent(vtxo)
```

## VtxoStatus State Machine

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

## Error Hierarchy

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

## Security Notes

> **This is an MVP SDK — not a production Ark implementation.**

The current implementation provides deterministic, locally-verifiable commitment proofs, but several critical components are stubs:

- **Operator receipts** are signed with `MOCK_OPERATOR_SIGNATURE`. In production, the operator signs over the commitment root using a real WOTS or Schnorr key, and clients must verify against the operator's published public key.
- **Commitment roots** are single-batch local roots, not pool-wide epoch roots. A full deployment requires the operator to broadcast a pool-wide commitment root across all live VTXOs each epoch, giving every holder a verifiable place in the pool's state tree.
- **Exit scripts** use `draftType: 'mock-exit'`. Real exits require audited KISSVM covenant exit scripts, a watchtower monitoring the on-chain dispute window, and Omnia factory settlement logic.
- **No watchtower / dispute monitoring.** Operator equivocation (signing two conflicting pool roots) is not detected. A production system needs an independent watchtower service.
- **No replay protection beyond nonce uniqueness.** Nonces must be globally unique per pool. Implementations must enforce this.

## Future Roadmap

- **Real Omnia factory backing** — Pool funds held in an N-of-N Omnia factory UTXO, with batch settlement on exit.
- **Batch refresh rounds** — Operator posts a new commitment root; all live VTXOs are refreshed in a single Minima transaction.
- **Operator signing** — Real WOTS receipts replacing `MOCK_OPERATOR_SIGNATURE`, with client-side signature verification.
- **Wallet integration** — Direct integration with Totem Wallet's coin selection and WOTS signing infrastructure.
- **Connect API methods** — `totem_mintVtxo`, `totem_transferVtxo`, `totem_listVtxos` exposed via the TOTEM_CONNECT dApp API.
- **Persistence adapters** — PostgreSQL and IndexedDB adapters for `OmniaVtxoStore`.
- **KISSVM exit script** — Audited on-chain exit covenant for unilateral exit with timelock enforcement.

## Canary Scenario

```ts
// Create pool → mint note → transfer → split → merge → refresh → exit → verify

const pool = createPool({ operator, tokenId, totalCapacity, nonce }, NOW);
const { pool: p1, vtxo: note } = mintVtxo(pool, { owner, amount, nonce: 'n1' }, NOW);
const { output: received } = transferVtxo(note, { recipient: 'MxBob', amount, nonce: 'n2' }, NOW + 1);
const { outputs: [a, b] } = splitVtxo(received, { amounts: [amount / 2n, amount / 2n], nonces: ['n3', 'n4'] }, NOW + 2);
const { output: merged } = mergeVtxos([a, b], { nonce: 'n5', owner: 'MxBob' }, NOW + 3);
const { refreshed } = refreshVtxo(merged, { newEpoch: 1, nonce: 'n6' }, NOW + 4);
const { draft } = createExitDraft(refreshed, NOW + 5);

const check = verifyVtxo(refreshed);
const conservation = verifyConservation({ inputs: [note], outputs: [received] });

console.assert(check.valid, 'VTXO proof must be valid');
console.assert(conservation.valid, 'Conservation must hold');
console.assert(draft.draftType === 'mock-exit', 'Exit draft type must be mock-exit');
```

## Runtime Compatibility

This package is **runtime-neutral** and compatible with Bare/Pear-style Totem Edge deployments. It does not import `node:crypto`, `fs`, `path`, `net`, `http`, `child_process`, DOM APIs, `window`, `document`, or `localStorage`. All deterministic functions accept injected `now` and `nonce` parameters — no hidden `Date.now()` or `randomUUID()` calls inside pure logic.

The only runtime dependency is `@noble/hashes` (SHA3-256), which is itself runtime-neutral and browser/Bare-compatible.

## License

MIT
