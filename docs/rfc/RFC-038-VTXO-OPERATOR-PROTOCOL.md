# RFC-038 — VTXO Operator Protocol

Status: In progress — V0 landed; V1 anchoring landed; V2 exit tx landed (owner covenant pending); V3/V4 next
Created: 2026-10-15
Authors: Totem SDK Contributors
Depends on: RFC-037 (unified WOTS), RFC-013 (WOTS leases), RFC-035 (peer coordination patterns), RFC-007 (storage durability)
Touches: `@totemsdk/omnia-vtxo`, `@totemsdk/omnia-pool`, `@totemsdk/omnia-relay`, wallet hosts

## 1. Problem

`@totemsdk/omnia-vtxo` is a **complete off-chain VTXO data + proof layer**: the
lifecycle (`mintVtxo`/`transferVtxo`/`splitVtxos`/`mergeVtxos`/refresh/exit), a
real Merkle commitment + proof layer (`computeVtxoLeaf`, `verifyMerkleProof`,
`verifyVtxo`/`verifyVtxoProof`/`verifyVtxoTransfer`/`verifyConservation`), a
durable registry, policy, and serialization. It is **not** yet a complete
**protocol**, because everything that authorizes and anchors a VTXO is stubbed:

- `constants.ts` defines `MOCK_OPERATOR_SIGNATURE = 'mock-operator-sig-v0'` and
  `MOCK_BATCH_ID = 'batch-local-mvp'`; every mutation stamps them.
- The `OmniaVtxoOperator { poolId, sign, verify }` port (`types.ts`) exists but is
  **never called**.
- `exit.ts` produces `ExitDraft.draftType: 'mock-exit'` — no real timelock tx.
- No `chain-provider`/`tx-builder` dependency: the pool UTXO / batch root is never
  committed on-chain, and `OmniaVtxo.fundingProof` is typed `unknown` and never
  constructed or verified.
- No owner↔operator transport; no operator-enforced global one-time-use.

This RFC specifies the operator protocol that turns the data layer into a real
VTXO primitive.

## 2. Goals

1. **Real operator co-signature.** Replace `MOCK_OPERATOR_SIGNATURE` with a WOTS
   operator signature (unified `TreeKey`, RFC-037) issued under a WOTS lease
   (RFC-013). The `OmniaVtxoOperator` port becomes load-bearing; mutations that
   produce a receipt become `async` and co-sign the batch commitment.
2. **On-chain anchoring.** The operator periodically commits a **batch root**
   (the VTXO Merkle root for an epoch) to an on-chain **pool output**; the pool
   UTXO and batch tx are built with `tx-builder` and broadcast via
   `chain-provider`. `fundingProof` becomes a real, verified deep proof.
3. **Real exit.** `createExitDraft` builds a genuine **timelock exit tx** (spends
   the pool output to the owner after `exitTimelockSeconds`), replacing
   `'mock-exit'`; `markExiting`/`markExited` follow the on-chain lifecycle.
4. **Owner↔operator round-trips.** Mint request, transfer co-sign, refresh, and
   exit claim run as verified round-trips over the relay, reusing the RFC-035
   patterns (verify-before-sign, durable proposals, lease confirm, consent).
5. **Global one-time-use.** The operator enforces that a VTXO is spent at most
   once across owners/epochs (authorization derives from the batch root + WOTS,
   never from transport identity).

## 3. Design

### 3.1 Operator identity & co-signature

- The operator is identified by a **WOTS tree-root public key** (RFC-037) and
  signs under a `WotsLeaseProvider` reservation (RFC-013), one leaf per receipt.
- `createVtxoOperator({ signer, leaseProvider, poolId })` implements
  `OmniaVtxoOperator` (`sign(data)` / `verify(data, sig)`), where `data` is the
  canonical batch commitment (see §3.2) and `verify` uses `verifyChannelSignature`
  (tree scheme).
- Every mutation-returning receipt (`VtxoOperatorReceipt.signature`) is produced
  by the operator over the canonical commitment. Mutations become `async` and
  take the operator (or its signer/lease) as a parameter. The mock constants are
  deleted.

### 3.2 Batch & epoch commitment (canonical bytes)

- An **epoch** is a set of VTXOs whose leaves form a Merkle root
  (`commitment.ts`). A **batch** commits `(poolId, epoch, root, capacityDelta)`.
- `computeBatchCommitment(poolId, epoch, root, orderedIds)` → 32-byte digest is
  the operator's signing payload; the `VtxoProof` (`epoch`, `batchId`, siblings)
  binds each VTXO to its root.
- `batchId` replaces `MOCK_BATCH_ID` with the digest of the committed batch.

### 3.3 On-chain anchoring

- **Target** pool: an on-chain output holding `totalCapacity`, spendable by
  `MULTISIG(2 operator owner)` / covenant (eltoo-style) so an epoch root update
  is a co-signed spend and an exit is a unilateral timelocked spend.
- **As implemented (V1)**: the pool script is **operator-only**
  (`SIGNEDBY(operator)`) and epoch-monotone
  (`ASSERT EPOCH GT PREVSTATE(101)`) — so a stale/rolled-back root cannot be
  re-anchored, but the pool output is *custodied by the operator* on-chain until
  the V2 owner-unilateral timelock/covenant branch lands. This is a known
  limitation (see §5).
- `anchorBatch(pool, batch)`: build + sign + broadcast the batch tx that writes
  the new root/epoch (via `tx-builder` + `chain-provider`), mirroring the Omnia
  factory funding flow (RFC-034 §6.4). The draft validates that the funding
  input's `fundingScript`/`fundingAddress` are the operator's own pool script.
- `fundingProof`: the deep proof of the pool output recorded at mint. In V1 it is
  **recorded but not verified**; on-chain verification (`verifyMerkleProof` +
  proof check) is V3.

### 3.4 Exit

- `createExitDraft(vtxo)` builds an exit tx spending the pool output to
  `vtxo.owner` with an absolute timelock = `now + policy.exitTimelockSeconds`
  (Minima `@COINAGE GTE`/timelock script), `draftType: 'vtxo-exit'`.
- `markExiting` → the draft is broadcast; `markExited(vtxo, { txpowId, now })`
  records the on-chain confirmation (the txpowId is stored as `exitTxpowId` and in
  the exit history). The exit-receipt guard (double-exit prevention) stays.

### 3.5 Owner↔operator transport

Reuse RFC-035's coordination transport and its invariants:

| Round-trip | Owner → Operator | Operator → Owner |
|---|---|---|
| mint | `VTXO_MINT_REQUEST` (amount, funding proof) | `VTXO_MINT_ACCEPT` (signed receipt, proof) |
| transfer | `VTXO_TRANSFER_PROPOSAL` (input, outputs) | `VTXO_TRANSFER_ACCEPT` (operator co-sign) |
| refresh | `VTXO_REFRESH_REQUEST` (newEpoch) | `VTXO_REFRESH_ACCEPT` |
| exit | `VTXO_EXIT_CLAIM` (draft) | (on-chain) |

- Verify-before-sign: the operator verifies the request against the current root
  and conservation (`verifyConservation`, strict for transfer/split/merge) before
  signing; owners verify the operator's receipt signature before accepting.
- Durable proposals + `*_FINALIZED`-style lease confirm (RFC-035 §6.4) so an
  aborted round-trip burns, never strands, the operator leaf.
- Consent: mint/transfer/exit are `requiresApproval` at the owner.

### 3.6 Double-spend enforcement

- The operator maintains the authoritative spent-set per epoch (derived from the
  batch root); a VTXO not present in the current root, or already spent in it,
  is rejected. Authorization is the root + WOTS signature — never the relay's
  `from`.

## 4. Phasing

- **V0 — landed.** `createVtxoOperator({ poolId, treeKey, leaseProvider })`
  implements `OmniaVtxoOperator` with a real WOTS (RFC-037) signature over the
  canonical `computeBatchCommitment(poolId, epoch, root, orderedIds)`
  (lease-backed, one leaf per signature; `verify` against the tree root). The
  `MOCK_OPERATOR_SIGNATURE` / `MOCK_BATCH_ID` constants are **deleted**: mutations
  now emit **unsigned** receipts, and
  `signVtxoReceipt(operator, receipt, batch)` / `verifyVtxoReceipt(...)` co-sign and
  verify them. `signVtxoReceipt` is **verify-before-sign**: it recomputes the batch
  root from the leaves, checks the receipt's outputs are members, enforces epoch
  monotonicity (`batch.epoch > batch.previousEpoch`) and value conservation, and
  only then signs. Operator signing is serialized (a per-operator mutex guards the
  shared `TreeKey`'s mutable `setUses`/`sign`). (Co-signing is a distinct operator
  step over the batch, rather than a per-mutation async call; this keeps the state
  machine synchronous.) A VTXO's proof `batchId` is set to the batch root.
  Tests: `operator.test.ts`, `receipt.test.ts`.
- **V1 — anchoring landed; mint validation pending.** `pool-script.ts` builds the
  operator-controlled, epoch-monotone state-carrying pool output (`STATE(100)=root`,
  `STATE(101)=epoch`, `ASSERT EPOCH GT PREVSTATE(101)`, `SIGNEDBY(operator)`);
  `anchor.ts` builds the batch-anchor draft (validating the funding input against
  the operator pool script/address), exposes `batchAnchorDigest`, and
  `anchorBatch(...)` signs the digest (injected signer), mines + broadcasts via a
  chain provider (injected miner). `checkPoolFunding(coinId, expected, chainProvider,
  opts?)` is a **presence/shape check** (existence + address/amount/token match +
  unspent + MMR proof fetched); it reports `proofVerified: false` unless a
  `verifyProof` callback is supplied. `mintVtxo` **records** the forwarded
  `fundingProof` but does not yet verify it. **Pending:** cryptographically verify
  the funding/MRR proof, and add the owner exit path (`STATE`/timelock) that shares
  this script. Tests: `anchor.test.ts`.
- **V2 — exit tx landed; owner covenant pending.** `exit-tx.ts` builds a real
  `vtxo-exit` transaction (spends the pool coin, pays the owner, carries the exit
  delay in `STATE(102)`), with a stable digest, `txHex`, and `buildExitTransaction`
  (sign + optional mine/broadcast). The `'mock-exit'` label is retired. **Pending:**
  the full owner-unilateral covenant — a timelock branch the owner can exercise
  without the operator, or a pre-signed exit tx — and wiring `createExitDraft` to
  carry the built tx. Tests: `exit-tx.test.ts`.
- **V3 — transport.** Owner↔operator round-trips over the relay (RFC-035 seam).
- **V4 — enforcement.** Operator spent-set + `omnia-pool` wiring.

## 5. Security

| Threat | Control | Landed |
|---|---|---|
| Forged receipt | WOTS verify-before-accept (§3.1); verify-before-**sign** recomputes the batch root; operator identity is the tree root | V0 |
| Double-spend a VTXO | Batch-root membership + operator spent-set (§3.6) | V0 (membership) / V4 (spent-set) |
| Stale/rolled-back root | Epoch monotonicity — operator-side on receipt, **and on-chain** (`ASSERT EPOCH GT PREVSTATE(101)`) | V1 |
| Operator withholds an exit | Unilateral timelocked exit tx (§3.4) | ⚠️ V2 — not yet: the V1 pool script is operator-only, so the operator can currently veto exits |
| Lease reuse | One reservation per receipt; burn on abort (§3.5) | V0 |
| Wrong-chain anchoring | `fundingProof` recorded at mint; `checkPoolFunding` checks address/amount/token/unspent | ⚠️ V1 — proof is recorded, not cryptographically verified (`proofVerified: false` unless a `verifyProof` callback is supplied) |

**Known V1 limitations.** (1) The pool output is custodied by the operator
on-chain (`SIGNEDBY(operator)`, no owner/timelock branch) — the owner cannot
unilaterally exit. (2) Batch signers/minters are injected; there is no
network/chain enforcement yet. (3) Mint `fundingProof` is recorded but not
verified. These are the driving items for V2–V4.

## 6. Non-goals

- Full Ark-spec wire parity; this is the Totem VTXO operator, sized to
  `omnia-vtxo`'s existing model.
- Replacing `omnia-pool` accounting (RFC-038 consumes it).

## 7. Acceptance

- A transfer produces a receipt whose signature verifies against the operator
  root (no constants remain).
- `verifyVtxo` + a real `fundingProof` validate a minted VTXO.
- An exit tx confirms on-chain after the timelock; a second exit draft is refused.
- A replayed/withheld operator response burns the lease and rejects late accepts.
- A VTXO spent in epoch N is rejected in epoch N (no double-spend).
