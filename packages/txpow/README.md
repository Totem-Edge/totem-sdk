# @totemsdk/txpow

**TxPoW — Minima's spam-prevention proof-of-work on every transaction.**

Every Minima transaction must carry a proof-of-work envelope before it can be broadcast. This package handles the full TxPoW lifecycle: serialize, mine, verify, and calibrate.

## Install

```bash
npm install @totemsdk/txpow
```

## What's inside

| Export | What it does |
|--------|-------------|
| `serializeTxHeader` / `serializeTxBody` / `serializeTxPoW` | Byte-identical TxPoW envelope assembly |
| `computeTxPoWId` | Derive the canonical TxPoW ID used for deduplication |
| `mineTxPoW(txBody, target)` | Local PoW mining loop — returns `{ minedHeaderBytes }` |
| `fetchTxPowTarget(axiaBaseUrl)` | Fetch current network difficulty from Axia |
| `verifyProofOfWork(txpowId, difficulty)` | Verify a received TxPoW (for relay nodes) |
| `calibrateHashRate()` | Benchmark local hardware hash rate |
| `estimateMiningCost(difficulty)` | Estimate mining time at current hash rate |
| `MAX_HASH`, `TX_POW_MIN_DIFFICULTY`, `CASCADE_LEVELS`, `MAIN_NET_CHAIN_ID` | Chain constants |

## Usage

### Mine and broadcast a transaction

```typescript
import {
  mineTxPoW,
  fetchTxPowTarget,
  serializeTxPoW,
  computeTxPoWId,
} from '@totemsdk/txpow';

// 1. Fetch current difficulty
const target = await fetchTxPowTarget('https://api.axia.to');

// 2. Mine (this runs the PoW loop — may take seconds)
const { minedHeaderBytes } = await mineTxPoW(txBodyBytes, target);

// 3. Assemble the final TxPoW envelope
const txpowBytes = serializeTxPoW(minedHeaderBytes, txBodyBytes);
const txpowId    = computeTxPoWId(txpowBytes);
console.log('TxPoW ID:', txpowId);

// 4. Broadcast
await provider.broadcastTxPoW(Buffer.from(txpowBytes).toString('hex'));
```

### Verify received TxPoW

```typescript
import { verifyProofOfWork } from '@totemsdk/txpow';

const ok = verifyProofOfWork(txpowId, difficulty);
if (!ok) throw new Error('Invalid proof-of-work');
```

### Calibrate hardware

```typescript
import { calibrateHashRate, estimateMiningCost } from '@totemsdk/txpow';

const hashesPerSecond = await calibrateHashRate();
const estimatedMs     = estimateMiningCost(targetDifficulty, hashesPerSecond);
console.log(`Expected mining time: ${estimatedMs}ms`);
```

## Upstream Java source

This package is a TypeScript port of Minima's TxPoW envelope structures. Canonical upstream references:

- [`objects/TxPoW.java`](https://github.com/spartacusrex-minima/minima-core/blob/main/src/org/minima/objects/TxPoW.java) — full TxPoW envelope
- [`objects/TxBody.java`](https://github.com/spartacusrex-minima/minima-core/blob/main/src/org/minima/objects/TxBody.java) — body serialization
- [`objects/TxHeader.java`](https://github.com/spartacusrex-minima/minima-core/blob/main/src/org/minima/objects/TxHeader.java) — header serialization
- [`objects/Witness.java`](https://github.com/spartacusrex-minima/minima-core/blob/main/src/org/minima/objects/Witness.java) — witness/signature data
- [`objects/CoinProof.java`](https://github.com/spartacusrex-minima/minima-core/blob/main/src/org/minima/objects/CoinProof.java) — coin proof structure
- [`objects/ScriptProof.java`](https://github.com/spartacusrex-minima/minima-core/blob/main/src/org/minima/objects/ScriptProof.java) — script proof structure

## See also

- [`@totemsdk/tx-builder`](https://www.npmjs.com/package/@totemsdk/tx-builder) — construct `txBodyBytes` before mining
- [`@totemsdk/node`](https://www.npmjs.com/package/@totemsdk/node) — Node.js wallet that uses txpow internally
- [`@totemsdk/chain-provider`](https://www.npmjs.com/package/@totemsdk/chain-provider) — `broadcastTxPoW` endpoint
