# VTXO V0 closeout status (October 2026)

**Status:** V0 is **not fully closed**. Four hardening items are landed; spend-state
integration and two adversarial cases remain.
**Scope:** `@totemsdk/omnia-vtxo`, Vouch claim acceptance, the V1 owner-state
covenant.
**Related:** [VTXO ownership and transferability](../VTXO_OWNERSHIP_AND_TRANSFERABILITY.md),
[offline-safety audit](offline-safety-claims-2026-10.md), RFC-038.

## 1. V0 checklist

| Item | Status | Evidence / remaining |
|---|---|---|
| Adopt anchored receipt verification in acceptance | **Done** | SDK `verifyVtxoReceiptForPool()` checks pool id, epoch and anchored root; Vouch `VtxoGateway.verifyReceiptForPool()` is called by `VtxoClaimSettlementPort` before a claim is accepted. Tests: `omnia-vtxo receipt.test.ts`, Vouch `vtxo.test.ts`. |
| Make funding proof mandatory at the SDK boundary | **Done** | `checkPoolFunding(..., { requireVerified: true })` fails closed without a verifier or with a rejected proof; Vouch settlement requires `proofVerified` by default. Tests: `anchor.test.ts`. |
| Define and implement spend-state authority | **Primitive + anchor boundary done; claim-settlement wiring pending** | `EpochAuthority` is a durable operator-signed journal: monotonic epochs, one root per epoch, spent-input rejection, conflict rejection and crash recovery. `anchorBatch` now records receipts and marks the epoch published only after broadcast. Tests: `epoch-authority.test.ts`, `anchor.test.ts`. Vouch’s claim settlement must supply the authority factory when VTXO mode is enabled. |
| Settle expiry semantics | **Done** | `expiresAt` is documented and tested as untrusted metadata (not in the leaf, not checked by `verifyVtxo`, dropped on transfer). Claim deadline, exit block and refresh deadline are defined separately. |
| Write the ownership ADR | **Done** | The ADR selects a one-owner enforceable claim. `recipient-pool` remains the non-transferable baseline; the owner-state covenant is the V1 transfer extension. Dynamic multi-holder pools and transaction-tree exits are research. |
| Add the adversarial suite | **Partial** | Covered: receipt-field tampering, exact conservation, stale epoch, conflicting root, double-spend input, crash-before-publish, epoch gap, wrong signer, wrong exit block/address/amount. Remaining: lost acknowledgement and cancel-then-reconcile (RFC-019 reservation flow), offline acceptance with an earlier snapshot, and a live-node race. |

## 2. V1 status

The owner-state covenant is implemented and published in `omnia-vtxo@0.7.0`
(VM-level proof with real WOTS). It is **not** yet live-node proven, and Vouch
still uses L1 settlement for real claims. The decisive A→B→exit test on an
isolated node remains the V1 gate.

## 3. Remaining V0 work before V1 is called complete

1. Wire `EpochAuthority` into the settlement/host path so a receipt is accepted
   only if it is recorded in the authoritative journal and matches the current
   epoch/root.
2. Add the lost-acknowledgement and cancel-then-reconcile cases at the RFC-019
   reservation boundary.
3. Add an explicit offline-acceptance test showing that a valid earlier snapshot
   is rejected by the authority (or that acceptance remains risk-bounded).
4. Run the isolated-node transfer/exit evidence.

## 4. Verification

```bash
pnpm --filter @totemsdk/omnia-vtxo test
# 20+ suites; includes owner-pool, epoch-authority, receipt and exit tests
```

Vouch:

```bash
cd "/Users/peter.cheek/Downloads/CRYSTAL_LABS/TOTEM/VTXO Claim Webapp"
pnpm test && pnpm typecheck
```
