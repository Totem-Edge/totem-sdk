# Offline-safety and builder-claim audit (October 2026)

**Status:** Audit + documentation/code corrections. Source review, not an
independent node/Java reproduction.
**Snapshot reviewed:** `07dbb267` (before this pass).
**Scope:** Omnia Eltoo offline claims, VTXO offline payments, token-amount
boundary, `txnpost auto:true`, script examples, privacy note.

## 1. Findings and corrections

| # | Finding | Verdict | Correction |
|---|---|---|---|
| 1 | A co-signed later update can be replayed against different eligible earlier channel coins; signatures bind a floating input descriptor and the witness binds the concrete coin | **Supported by Java source review; SDK integration reproduction still required** | Recorded here; no code change. Do not cite as SDK-tested until an SDK replay test exists. |
| 2 | Token-input amounts: Omnia builders carry raw amounts; `minima-rpc` passes `txninput.amount` through; Java converts floating token-input units to raw | **Valid integration hazard, not a broken settlement path** | Added `toRawTokenAmount()` at the explicit builder boundary; documented that `txnmine`/`sendtransaction` bypasses `txninput`; no implicit conversion added to Omnia or the generic transport. |
| 3 | `txnpost auto:true` after manual input appends proofs again (`txncheck` can miss the later failure) | **Credible; documented sequence corrected** | Documented `build → txnbasics → sign → txncheck → txnpost id:<id> mine:true`, with an explicit “no `auto:true` after manual inputs” warning. Node-acceptance regression still needs a live node. |
| 4 | “Offline for a week is safe” / “Eltoo eliminates watchtowers” | **Overclaim** | Corrected Blue Paper and EEFI guide: 256 blocks ≈ **3 h 33 min 20 s** at 50 s blocks; stale-close detection + newer-state confirmation inside the window is still required; a delegate/watchtower or longer delay is needed; S11 is pending. |
| 5 | Offline VTXO acceptance: Merkle proof proves membership, not non-spend; sender can retain an earlier active snapshot; new split outputs do not inherit the old root | **Correct and material** | Tightened Blue Paper vending example and `transferVtxo` JSDoc: offline **delivery** supported; final **acceptance** needs an anti-double-spend mechanism and an authenticated new commitment. The host-local double-transfer guard covers only shared state. |
| 6 | Script examples use uppercase KISSVM variables; canonical builders apply `toNodeScript` | **Documentation drift** | Blue Paper now labels the excerpt illustrative and points executable examples at the `@totemsdk/kissvm` builders. |
| 7 | IP hashing with a public salt; identity hash `SHA3(root_pubkey)` is linkable when both tables are compromised | **Correct** | Privacy note now requires keyed **HMAC-SHA-256** with rotation/retention for IPs, and states that `user_identity_hash` can be matched by hashing stored `root_pubkey` values — code separation is not cryptographic unlinkability. |

## 2. What this pass did not prove

- The Java protocol result was not reproduced against a real node from this
  repository; the SDK still needs a replay test for the co-signed-update claim.
- `txnpost` acceptance/confirmation was not re-run against a live hawk node; the
  documented sequence and the `auto:true` warning are based on source review.
- S11 (Axia watchtower) remains pending (`docs/OMNIA_TEST_RESULTS.md`).
- The identity-hash unlinkability fix is a protocol change, not implemented here;
  the note now states the pseudonymity limit explicitly.

## 3. Follow-ups

1. Add an SDK replay test for the floating-input descriptor claim.
2. Add a live-node regression for `build → txnbasics → sign → txncheck →
   txnpost` and a negative test for `auto:true` after manual inputs.
3. Replace the privacy identity header with a keyed, rotating value (or stop
   co-storing the root public key) before claiming unlinkability.
4. Implement the operator commitment path for offline VTXO acceptance; keep the
   vending example explicitly risk-bounded until then.
