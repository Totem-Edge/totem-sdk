# VTXO hardening and multiparty test plan

Status: **Proposed — execution starting.** Follow-on to the S6 VTXO lifecycle
tests and the non-custodial S6/S10 run.

## Scope

This plan covers two layers:

1. **Hardening suite** — adversarial, durability and operator-boundary tests for
   the existing single-operator VTXO lifecycle.
2. **Multiparty suite** — one operator pool issuing/transferring shares to six
   independent owners, with independent proof verification, claims and exits.

The multiparty suite does **not** require seven Omnia channel hosts. The minimum
is one operator host plus six owner wallets. A seven-node transport layout is
only needed when testing owner↔operator delivery over the relay or when mixing
VTXO claims with multihop channel liquidity.

## Test topology

```text
operator host (pool + VTXO registry + node RPC)
        |
        +-- wallet/owner 1
        +-- wallet/owner 2
        +-- wallet/owner 3
        +-- wallet/owner 4
        +-- wallet/owner 5
        +-- wallet/owner 6
```

For chain-bound cases, the operator host uses a private test node. For
offline-operator cases, the operator API is stopped after shares are delivered.

## H — hardening suite

| ID | Test | Proves | Status |
|---|---|---|---|
| H1 | Non-custodial operator host + separate wallet service | Host has no seed; receipt signing is delegated | PASS (S6_S10_NONCUSTODIAL) |
| H2 | Tampered receipt: wrong root, epoch, output set, signature | Receipt verification fails closed | PASS |
| H3 | Funding proof: wrong pool address/amount/token, spent coin, tampered MMR proof | `proofVerified` cannot be spoofed | PASS (verifier callback required for cryptographic proof) |
| H4 | Durable restart: crash between reserve/commit, pending receipts | No VTXO/lease reuse or receipt loss | PASS (durable-store reopen) |
| H5 | Global spent-set / double-spend: same VTXO twice, spent then exit, replay | One-time-use across owners/epochs | PASS (store refuses resurrection of consumed VTXOs) |
| H6 | Anchor + exit live: anchor batch, exit after timelock, double exit | On-chain anchoring and per-share exit | PARTIAL — live anchor PASS via `txnmine` and future exitBlock; live exit crashes node with `MiniNumber value out of int range` |
| H7 | Pool conservation: VTXO claims vs LP allocations/withdrawals | No owner-share or accounting confusion | PASS (pool suite 40/40) |
| H8 | Host hardening: idempotency, concurrent mutations, RPC/operator failure, audit | No duplicate mutations or lost operations | PASS (idempotency + concurrent transfer guard; durable audit still separate) |

## M — multiparty extensions

### Tier 1 — builds on current primitives

| ID | Test | Proves |
|---|---|---|
| M1 | Six-owner fan-out from one pool mint/split | Six owners independently verify the same batch root and exit exact shares |
| M2 | Split + change to six recipients | Sum conservation and correct change ownership |
| M3 | Chained ownership A→B→C | Final owner can exit; prior owners cannot claim |
| M4 | Concurrent claims by six owners | No double-claim of one share |
| M5 | Operator-offline exit | All six exit after timelock without operator liveness |
| M6 | Stale epoch/root replay | Old proofs fail against newer roots |
| M7 | Merge rules | Same-owner merge passes; cross-owner merge is refused without joint consent |

### Tier 2 — new VTXO semantics

| ID | Test | Proves |
|---|---|---|
| M8 | 2-of-3 co-owned VTXO | One owner cannot transfer/exit without threshold consent |
| M9 | Conditional VTXO (hashlock + timelock) | Escrow claim/refund path |
| M10 | Atomic DvP: VTXO share ↔ Omnia HTLC/payment | Neither side can claim alone |
| M11 | Delegated claim with scope/expiry/revocation | Agent cannot exceed the owner's mandate |
| M12 | Operator rotation / epoch migration | Old-operator proofs fail; new exits work |
| M13 | Six-LP fee/yield distribution as VTXOs | Claims match pool accounting pro-rata |
| M14 | Cross-pool / cross-token isolation | Proof cannot be replayed into another pool/token |
| M15 | Griefing/liveness with one malicious owner | Remaining owners still exit within bounds |
| M16 | VTXO-backed channel/factory collateral | Shares release correctly on channel/factory close |
| M17 | Vesting/payroll/streaming claims | Six beneficiaries claim on distinct schedules |
| M18 | Guardian/social recovery | M-of-N guardians authorize recovery of an owner share |

## Execution order

1. H2–H4 (receipt, funding proof, durability)
2. M1–M3 (fan-out, split/change, chained ownership)
3. H5 + M4 (spent-set and concurrent claims)
4. M5–M6 (operator-offline exits, stale roots)
5. H6–H7 (anchor/exit and pool conservation)
6. M7–M14 (new semantics, operator rotation, yield)
7. M15–M18 (adversarial liveness, collateral, vesting, recovery)
8. H8 (host idempotency/concurrency/audit)

## Pass criteria

- Every owner verifies its own proof/root; no owner can claim another share.
- Total claims + change + pool remainder equals the pool commitment.
- A failed receipt/funding/proof check never mutates stored state.
- A restart never reuses a lease, VTXO, receipt or exit.
- A double-spend or stale-root claim is rejected before any state mutation.
- Operator loss does not prevent per-share exits after the timelock.
