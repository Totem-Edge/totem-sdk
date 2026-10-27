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
| Define and implement spend-state authority | **Done** | `EpochAuthority` is a durable operator-signed journal: monotonic epochs, one root per epoch, spent-input rejection, conflict rejection, idempotent retry and crash recovery. `anchorBatch` records receipts before broadcast and marks the epoch published only after broadcast. Vouch’s `VtxoClaimSettlementPort` requires an authority factory and passes it into the anchor. Tests: `epoch-authority.test.ts`, `anchor.test.ts`, Vouch `vtxo-settlement.test.ts`. |
| Settle expiry semantics | **Done** | `expiresAt` is documented and tested as untrusted metadata (not in the leaf, not checked by `verifyVtxo`, dropped on transfer). Claim deadline, exit block and refresh deadline are defined separately. |
| Write the ownership ADR | **Done** | The ADR selects a one-owner enforceable claim. `recipient-pool` remains the non-transferable baseline; the owner-state covenant is the V1 transfer extension. Dynamic multi-holder pools and transaction-tree exits are research. |
| Add the adversarial suite | **Done for the VTXO boundary; live-node race remains V1** | Covered: receipt-field tampering, exact conservation, stale epoch, conflicting root, double-spend input, lost-acknowledgement idempotent retry, offline earlier-snapshot rejection, crash-before-publish, epoch gap, wrong signer, wrong exit block/address/amount. Cancel-then-reconcile is covered by the existing RFC-019 `agent-policy` reservation-recovery suite; the VTXO path does not own a cancel surface. |

## 2. V1 status

The owner-state covenant is implemented and published in `omnia-vtxo@0.7.0`
(VM-level proof with real WOTS). It is **not** yet live-node proven, and Vouch
still uses L1 settlement for real claims. The decisive A→B→exit test on an
isolated node remains the V1 gate.

## 3. V0 status

V0 is closed at the SDK/Vouch boundary. The remaining gate is V1 live evidence:
run the isolated-node A→B transfer, double-recovery attempt and independent exit.
The VTXO path still requires a deployment-supplied durable journal adapter; the
reference scaffold refuses production startup until one is configured.

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
