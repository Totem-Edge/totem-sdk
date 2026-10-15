# RFC-038 — VTXO Operator Protocol

Status: In progress — V0 core landed (operator co-signature + batch commitment); mutation wiring + constants retirement next
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

- The pool is an on-chain output holding `totalCapacity`, spendable by
  `MULTISIG(2 operator owner)` / covenant (eltoo-style), so an epoch root update
  is a co-signed spend and an exit is a unilateral timelocked spend.
- `anchorBatch(pool, batch)`: build + sign + broadcast the batch tx that writes
  the new root/epoch (via `tx-builder` + `chain-provider`), mirroring the Omnia
  factory funding flow (RFC-034 §6.4).
- `fundingProof`: the deep proof of the pool output recorded at mint; verified on
  receipt (`verifyMerkleProof` + on-chain proof check).

### 3.4 Exit

- `createExitDraft(vtxo)` builds an exit tx spending the pool output to
  `vtxo.owner` with an absolute timelock = `now + policy.exitTimelockSeconds`
  (Minima `@COINAGE GTE`/timelock script), `draftType: 'vtxo-exit'`.
- `markExiting` → the draft is broadcast; `markExited(txpowId)` records the
  on-chain confirmation. The exit-receipt guard (double-exit prevention) stays.

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

- **V0 — core landed.** `createVtxoOperator({ poolId, treeKey, leaseProvider })`
  implements `OmniaVtxoOperator` with a real WOTS (RFC-037) signature over the
  canonical `computeBatchCommitment(poolId, epoch, root, orderedIds)`
  (lease-backed, one leaf per signature; `verify` against the tree root).
  **Remaining V0:** thread the operator through each mutation
  (`mint`/`transfer`/`split`/`merge`/`refresh`/`exit`) so receipts carry the real
  signature, and delete `MOCK_OPERATOR_SIGNATURE` / `MOCK_BATCH_ID`.
- **V1 — on-chain anchoring.** Pool output script + batch tx (`anchorBatch`) via
  tx-builder/chain-provider; real `fundingProof` verify.
- **V2 — real exit.** Timelock exit tx; retire `'mock-exit'`.
- **V3 — transport.** Owner↔operator round-trips over the relay (RFC-035 seam).
- **V4 — enforcement.** Operator spent-set + `omnia-pool` wiring.

## 5. Security

| Threat | Control |
|---|---|
| Forged receipt | WOTS verify-before-accept (§3.1); operator identity is the tree root |
| Double-spend a VTXO | Operator spent-set + batch root (§3.6) |
| Stale/rolled-back root | Epoch monotonicity; refresh commits a new root on-chain |
| Operator withholds an exit | Unilateral timelocked exit tx (§3.4) |
| Lease reuse | One reservation per receipt; burn on abort (§3.5) |
| Wrong-chain anchoring | fundingProof verified at mint (§3.3) |

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
