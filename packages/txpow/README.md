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

## Machine Work Admission

Machine Work Admission allows applications to require computational proof before allocating scarce resources. The work is performed against a Minima block candidate so that application anti-spam work simultaneously searches for valid Minima blocks.

A receiver issues a `WorkChallenge` (unique, expiring, bound to the receiver and an application domain). A sender commits its application action into the TxPoW header's `customHash` field and mines the nonce space of a real current Minima block candidate. If the hash beats the receiver's admission target, the machine action is admissible. If the same hash also beats the current Minima block target, the candidate is a genuine Minima block (Super-0 … Super-31) and is relayable.

Ordinary admission proofs stay off-chain. Only actual Minima blocks are eligible for relay.

```typescript
import {
  createWorkChallenge,
  mineWorkAdmission,
  verifyWorkAdmission,
  type MinimaWorkTemplateProvider,
  type MinimaWorkRelay,
} from '@totemsdk/txpow';

// Receiver: issue a challenge (target chosen by receiver policy)
const challenge = createWorkChallenge(
  'receiver-address',
  'totem.compute.reserve',
  admissionTargetHex,
);

// Sender: mine the admission proof against a real Minima block candidate
// The relay boundary keeps Minima networking out of the core primitive.
const relay: MinimaWorkRelay = {
  submitBlock: async (envelope) => node.submitBlock(envelope),
};
const provider: MinimaWorkTemplateProvider = {
  getCurrentTemplate: async () => node.fetchCurrentTemplate(),
  getLatestTemplate: async () => node.fetchCurrentTemplate(),
};

// The challenge target is the single authoritative admission target.
const proof = await mineWorkAdmission(action, challenge, provider, { relay });

// Receiver: verify (never trusts sender-reported hardware speed)
const result = await verifyWorkAdmission(action, challenge, proof, provider);
if (result.valid) {
  // allocate the scarce resource
}
```

### Minima Super level

A TxPoW is a Minima block when `txpowId < blockDifficulty`. Its strength is the exact Minima Super level:

```text
superLevel = floor(log2(blockDifficulty / txpowId))
```

with `MINIMA_CASCADE_LEVELS = 32`, clamped so the maximum represented value is 31.

| `superLevel` | Meaning |
|--------------|---------|
| `-1` | not a Minima block |
| `0` | ordinary/base Minima block (Super-0) |
| `1` | stronger block (Super-1) |
| … | |
| `31` | maximum represented Super level |

**Super-0 is an ordinary valid Minima block. Non-block TxPoWs have computed Super level -1.** Super level describes block strength — it is not a relay policy. Every valid current block (Super-0 … Super-31) is eligible for relay.

### Three distinct claims

Verification distinguishes three claims that must never be confused:

| Claim | Meaning | Field |
|-------|---------|-------|
| **A. admission-valid** | the hash satisfies `challenge.target` | `valid` |
| **B. Minima block** | the hash beats the block difficulty encoded by the candidate template | `superLevel` / `isBlock` |
| **C. broadcastable** | a Minima block AND the template is still current AND a live template provider was supplied | `broadcastable` |

A stale candidate may remain `valid = true` (and `superLevel >= 0`) while `broadcastable = false`. Offline verification (no `MinimaWorkTemplateProvider`) leaves `broadcastable` undefined — it does **not** claim Minima block contribution.

`proof.superLevel`, `proof.isBlock`, and `proof.qualifiesAsMinimaBlock` are derived metadata recorded at mining time. Verification never trusts them — they are recomputed from the re-derived TxPoW ID and the template's block difficulty.

### Distributed mining boundary

Machine Work Admission is primarily local/off-chain: the requesting machine performs the work, which keeps it attributable to the machine requesting admission. Native Minima distributed mining (`MSG_TXBLOCKMINE`, where receiving peers reset the body PRNG to create independent search spaces) is a separate, optional, rate-limited, integration-controlled mechanism. It is NOT used per machine action — broadcasting every machine action through `MSG_TXBLOCKMINE` would turn machine anti-spam into Minima network spam. The body PRNG is independent candidate entropy; it never changes the `customHash` application commitment.

### Authentication boundary

`validateWorkChallenge()` validates structural/freshness/domain/recipient properties but does **not** prove that the claimed recipient actually issued the challenge. A `WorkChallenge` is a plain data object; anyone can construct one claiming any recipient. Proving the issuer requires authenticating the enclosing message (e.g. a signed machine-to-machine protocol message in the Edge negotiation layer). `@totemsdk/txpow` deliberately does not implement a parallel identity/signature system.

The primitive is generic — it knows only "there is an application action represented by canonical bytes". Domain-specific packages supply the action commitment for negotiation, compute, storage, mailbox, sensor, or rendezvous domains. It does NOT prove identity, authority, payment, or resource availability; higher-level layers must still perform those checks.

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
