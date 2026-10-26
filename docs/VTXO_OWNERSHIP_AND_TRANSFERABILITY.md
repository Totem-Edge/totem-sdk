# VTXO ownership and transferability decision

Status: **Decision required / V0 gate.**
Scope: RFC-038, Eefi Voucher V1, M8–M18 claim policies.

## 1. The mismatch

`transferVtxo()` changes the VTXO `owner` field off-chain. The funded pool script
does not name that new owner: it commits a fixed holder list and fixed share
ports (`STATE(128+k)`), capped below the MSHS floor.

Therefore, for an arbitrary recipient:

> a valid new VTXO proof is not yet an enforceable on-chain exit entitlement.

This must not be marketed as transferable self-custody until the recipient can
independently recover the backing after the operator disappears.

## 2. Options considered

### A. Fixed-holder pool only

Transfers are allowed only within the named holder set. Any new recipient
requires a cooperative on-chain pool update signed by operator + all holders.

- Pros: matches current script; smallest change.
- Cons: unsuitable for vouchers/payroll with arbitrary recipients; every
  recipient change needs all existing holders online.
- Verdict: acceptable for closed groups, not for Eefi Voucher.

### B. Dynamic owner-set committed in one state root

Commit a Merkle root of `(owner, share)` leaves into the pool state and have the
exit branch verify an inclusion proof.

- Pros: arbitrary recipient set without changing the holder list.
- Cons: KISSVM must verify the owner/share proof inside the exit branch; state
  port budget is tight; needs a new covenant and adversarial proof review.
- Verdict: possible long-term, not a V1 quick win.

### C. Transaction-tree / pre-signed exits

Each transfer delivers a new, fully signed per-share exit transaction (or a
pre-signed exit tree), so the recipient holds an executable L1 recovery path
without the operator.

- Pros: matches the Ark-style property that recovery is a transaction path, not
  merely a Merkle membership proof; operator cannot withhold exit.
- Cons: storage/growth per transfer, exit-tx fee/coinage handling, and receiver
  must verify the pre-signed transaction before accepting.
- Verdict: **recommended V1 target**.

## 3. Decision

1. **Phase 1 Eefi Voucher** remains on-chain treasury payouts. It must not claim
   pooled VTXO backing or self-custodial transferability.
2. **Closed-group pools** may use fixed holders now.
3. **Arbitrary-recipient VTXO transfer** is gated on option C: the recipient
   must receive an independently executable exit path.
4. Until option C is implemented and live-tested, `transferVtxo()` is an
   off-chain ledger transfer, not a proven recovery entitlement.

## 4. V1 acceptance test (non-negotiable)

1. Alice holds a funded VTXO backed by pool coin P.
2. Alice transfers to Bob; Bob verifies the claim, backing and exit package.
3. Alice attempts to spend/exit the same value again.
4. Operator disappears.
5. Bob independently reconstructs, signs, broadcasts and confirms the exit.
6. Bob receives exactly the owed value.
7. Alice and every other holder lose nothing.
8. Replay, stale epoch/root, conflicting receipt and crash/restart paths fail
   closed.

## 4a. Implemented groundwork

`VtxoExitEntitlement` now binds the exit tx/digest/witness to the VTXO,
owner, amount, pool coin, holders/shares, root, epoch and exit block.
`transferVtxo(..., { exitEntitlement })` requires a full-value transfer and
rejects a mismatched entitlement, then carries it to the recipient output.

The host now refuses a transfer without an exit entitlement unless the caller
explicitly passes `unsafeLedgerTransfer:true`, which is reserved for legacy
ledger-only tests. Host transfers are therefore guarded by default.
`transferVtxoWithExit()` now builds and verifies the recipient exit before
moving the claim, so new integrations should use it instead of raw
`transferVtxo()`.

## 5. Required protocol work

- Define `ExitEntitlement` (vtxo id, owner, amount, pool coin, exit tx/digest,
  exit block, signature).
- Bind the entitlement into the VTXO receipt and transfer acceptance.
- Require recipients to verify the exit tx before treating a transfer as final.
- Make operator receipt state globally authoritative across replicas.
- Define expiry/renewal separately from exit timelock.

## 6. Explicit non-goals until V1 passes

- Public pooled-yield products.
- Permissionless bearer cash.
- Inter-pool clearing.
- Unlimited voucher issuance backed by pooled VTXOs.
