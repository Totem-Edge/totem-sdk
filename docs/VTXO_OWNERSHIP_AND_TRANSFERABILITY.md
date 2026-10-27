# VTXO ownership and transferability decision

Status: **V1 design selected — owner-state covenant; core implemented.**
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

- Pros: recovery is a transaction path, not merely a Merkle membership proof.
- Cons: the current fixed-holder script pays the **committed holder**, so a
  pre-signed exit for Alice cannot pay Bob without a covenant change. Storage
  and fee handling also grow per transfer.
- Verdict: **not sufficient alone on the current pool script.**

### D. Current owner committed in state (selected)

A single-owner claim coin commits the current owner public key and payout
address in state. The previous owner rotates the owner by signing a state update
to the same address/amount; after `exitBlock`, the committed owner exits to its
committed address with no operator signature.

- Pros: arbitrary recipient transfer with an enforceable unilateral exit; no
  fixed holder list; the UTXO set is the spend authority, so Alice cannot
  double-recover after a confirmed transfer; the operator is not needed after
  funding.
- Cons: one coin per claim (on-chain footprint); the transfer window closes at
  `exitBlock`; the recipient must wait for confirmation before accepting.
- Verdict: **V1 target. Implemented in `owner-pool.ts`.**

## 3. Decision

1. **Phase 1 Eefi Voucher** remains on-chain treasury payouts. It must not claim
   pooled VTXO backing or self-custodial transferability.
2. **Closed-group pools** may use fixed holders now.
3. **Arbitrary-recipient VTXO transfer** uses the owner-state covenant (option
   D): the recipient receives a coin whose committed owner they control, with a
   unilateral exit path.
4. `transferVtxo()` remains an off-chain ledger transfer unless paired with an
   enforceable owner coin. `transferVtxoWithExit()` is only valid when the
   recipient is already a committed holder; it is not an arbitrary-recipient
   transfer.

## 4. V1 acceptance test (non-negotiable)

The selected V1 form is an **owner-state claim coin**, not a pooled bearer
VTXO. The test is run against that covenant.

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

- **Owner-state covenant (landed):** `buildOwnerPoolScript()` authenticates the
  committed previous owner (`SIGNEDBY(PREVSTATE(103))`) for both transfer and
  exit; `buildOwnerTransferDraft()` / `buildOwnerExitDraft()` and the signed
  transaction assemblers are in `packages/omnia-vtxo/src/owner-pool.ts`.
- **Transfer confirmation rule:** a recipient must not treat a transfer as final
  until the owner-rotation transaction is confirmed; an unconfirmed transfer can
  lose a race to the previous owner's exit.
- **Initial state verification:** the funder must commit the recipient's public
  key and the address derived from it; a mismatched owner address is rejected by
  the builders.
- **Exit block:** the transfer window closes at `exitBlock`; after that the
  owner's unilateral exit path is the only owner-authorized spend.
- **Operator receipts / global ledger:** still required for batch claims, but
  the owner coin's UTXO set is the spend authority for a single claim.
- **Expiry/renewal:** keep expiry separate from the exit timelock; do not claim
  that a VTXO expires unless the expiry is committed and enforced.

## 6. Explicit non-goals until V1 passes

- Public pooled-yield products.
- Permissionless bearer cash.
- Inter-pool clearing.
- Unlimited voucher issuance backed by pooled VTXOs.
