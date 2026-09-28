# KISSVM / Recursive-MAST / `tx-builder` — Independent Adversarial Security Audit (2026-09)

**Date:** 2026-09-28
**Scope:** `@totemsdk/kissvm`, `@totemsdk/recursive-mast`, `@totemsdk/tx-builder`
**Audited commit:** `c6425eef0d89b3b2f26fb93ce7525e7e72300602` (branch `main`)
**Method:** source review of every file in the three packages, byte-level hash reconciliation, parallel workers + lead verification, and deterministic node PoCs against a fresh `tsc` build of `src`.
**Companion contract:** [RFC-018](../rfc/RFC-018-KISSVM-ADVERSARIAL-REMEDIATION.md)

> This is the **second** adversarial pass on this surface; the first is
> [kissvm-template-audit-2026-09.md](kissvm-template-audit-2026-09.md), which RFC-016
> responded to. RFC-016 fixed the first-order criticals but left second-order
> composition/verification holes.

> **Verification note (2026-09-28, HEAD `bed1488`):** the Critical and top High
> findings below were independently reproduced on current `main`. `dist/` is
> gitignored in this repository, so `DIST-001` is a build-freshness concern
> (stale local `dist` resolvable by workspace consumers), not a committed artifact.

---

## 1. Executive summary

The RFC-016 pass fixed a large fraction of the original criticals (statechain
reclaim, ActionAuthorization, PaymentIntent, proof delegation, heartbeat, escrow,
decay, liquidity/provider economics, canonical MAST roots, witness ScriptProofs,
multisig readiness in source). The hardening is **not complete**, and several
fixes exist only in source, not in the locally-built artifact.

| Severity | Count |
|----------|-------|
| Critical | 3 |
| High | 11 |
| Medium | 16 |
| Low/Info | 8 |

Most consequential results:

- **MULTISIG does not de-duplicate keys** → the statechain normal branch collapses
  from 2-of-2 to 1-of-1 (SE alone spends). Reproduced.
- **`toNestedMastScript` places a terminal MAST after a `RETURN`** (both packages)
  → composed delegation/proof chains skip downstream layers. Reproduced.
- **The RFC-016 invariant detector is opt-in and under-specified** — it accepts
  `SIGNEDBY(STATE(n))` and mutable unlocks unless the caller separately declares
  the ports. Reproduced.
- **`verifySigningRequest()` never verifies `requesterSignature`**, and the
  signing session accepts self-asserted roles/signatures.
- **The locally-built dist predates the hardening**, so consumers of a stale
  build still get vulnerable behaviour.

---

## 2. Newly discovered findings

### Critical

| ID | File | Problem |
|----|------|---------|
| **KISSVM-MULTISIG-001** | `kissvm/src/eval.ts:348-356`, `kissvm/src/templates/statechain.ts:23` | `MULTISIG` counts duplicate key positions; `MULTISIG(2 STATE(ownerPort) 0xSE)` with successor `STATE(ownerPort)=sePk` lets one SE signature satisfy a 2-of-2. Same flaw in `rust/src/eval.rs`. |
| **RM-COMPOSE-001** | `kissvm/src/mast/proof-chain.ts:208-222`, `recursive-mast/src/proof-chain.ts:193-204` | `toNestedMastScript` appends `MAST 0x<child>` after a layer script that still ends in `RETURN`; MAST is terminal, so the child is dead. |
| **RM-LAYER-001** | `recursive-mast/src/layered-policy.ts:19-23`, `delegation.ts:175-179`, `kissvm/src/mast/layered-policy.ts:123` | `stripTrailingReturn` matches any terminal `RETURN …`, including `RETURN FALSE`, turning an explicit deny into "authorize + delegate". A trailing comment/blank after `RETURN TRUE` also defeats the strip. |

### High

| ID | File | Problem |
|----|------|---------|
| **KISSVM-EVAL-EXECMAST-001** | `kissvm/src/eval.ts:886-902` | `EXEC MAST` executes `scriptProofs[0].script` without parsing/verifying `proofHex`. Latent (no template emits it yet) but becomes Critical once a builder does. |
| **KISSVM-EVAL-MASTBRANCH-001** | `kissvm/src/eval.ts:839-852, 886-900, 922-926` | Legacy `mastBranches` fallback bypasses MMR membership entirely; reachable via `witness-adapter.ts` (optional `scriptProofs`). |
| **KISSVM-INV-001** | `kissvm/src/invariants.ts:124-186` | Detector false negatives: `SIGNEDBY(STATE(n))` not flagged; I3 opt-in only; VERIFYOUT/IF checks presence-based. |
| **RM-SIGN-VERIFY-001** | `recursive-mast/src/policy-signing.ts:472-555` | `verifySigningRequest` has no requester-signature parameter/check; `outputsMatch` never populated; `branchVerifier` called with the wrong root. |
| **RM-SESSION-001** | `recursive-mast/src/signing-session.ts:146-177` | `acceptResponse` trusts self-asserted roles/signatures; does not bind `response.requestId` to the session; one signer can fill several roles. |
| **RM-SIGN-COLLECT-001** | `recursive-mast/src/policy-signing.ts:298-375` | Completion requires a signature per role (fixed), but signatures are never cryptographically verified and roles are self-asserted. |
| **KISSVM-TEMPLATE-AUTH-001** | `kissvm/src/templates/authority.ts:57-85` (stable) | `buildMandateEnforcementScript` reads expiry from mutable `STATE`; config `expiresAtBlock` unused → grantor can extend its own mandate. |
| **KISSVM-TEMPLATE-AUTH-002** | `kissvm/src/templates/authority.ts:139-169` (stable) | `buildUsageTrackingScript` has no authorization and a spender-chosen window. |
| **TXB-MULTISIG-001** | `tx-builder/src/multisig-manager.ts:211-242, 327-350` | `threshold<=0` (or empty signer set) is `ready` with zero signatures; configs accepted from arbitrary input. |
| **KISSVM-EXPERIMENTAL-\*** | `kissvm/src/templates/{treasury,voting,state-machine,sensor-proof,firmware-update}.ts` | Reproducible economic/authorization failures on the experimental surface (unclamped vesting, un-advanced counters, self-delegation, optional operator, post-terminal-MAST dead checks). |
| **RM-ACTION-001** | `recursive-mast/src/transaction/action-transaction.ts:38-48` | When `actionSelectorPort === 0`, `stateChanges[0] = subjectId` is overwritten with `'0'`, violating anchor `STATE(0) EQ subjectId`. |

### Medium (condensed)

| ID | File | Problem |
|----|------|---------|
| KISSVM-TEMPLATE-IA-001 | `industrial-action.ts:94-100` | Notice block read from mutable `STATE` → backdated activation. |
| KISSVM-TEMPLATE-MANIFEST-001 | `manifest.ts:68` | Expiry script has no signature; interval bypass via port 2 = 0. |
| KISSVM-TEMPLATE-AGENT-001 | `agent-policy.ts:53-71` | Permissionless proposal; mutable confidence; empty transitions emit invalid script. |
| KISSVM-TEMPLATE-GOV-001 | `governance.ts:289-344` | Mandate/treasury "proof" checks only `NEQ 0x00`; timeouts from mutable STATE. |
| KISSVM-CONTAINS-001 | `eval.ts` (no `CONTAINS`), 14 template sites | `ASSERT CONTAINS(...)` → unknown function → affected scripts unparseable (fail-closed but unusable). |
| KISSVM-TEMPORAL-001 | `temporal.ts:203-216` vs `:53-57` | `computeRelease` returns `0n` when `duration<=0`, but the on-chain script vests total → divergence. |
| KISSVM-PREVSTATE-001 | `mast/prevstate.ts:73-200` | Workflows end with `ASSERT`, no `RETURN` → always "Script ended without RETURN". |
| RM-MIGRATION-001 | `migration.ts:51-147` | Appended MAST after terminal `toRoot`; `step.proof` unused. |
| RM-CONTENTKEY-001 | `content-keys.ts:83-85` | `computeScriptHash = sha3(utf8(script))` ≠ canonical MMR leaf → branches unreachable. |
| KISSVM-HASH-001 | `governance.ts:3-7`, `recovery.ts:255` | Additional non-canonical script-hash helpers coexist with the canonical leaf. |
| TXB-MULTISIG-002 | `multisig-manager.ts:145-157, 339` | Persisted `validated:true` trusted on load. |
| TXB-MULTISIG-003 | `multisig-manager.ts:327-350, 366, 382` | Terminal statuses rewritten back to pending/ready. |
| TXB-MULTISIG-004 | `multisig-manager.ts:183-209` | Duplicate keys accepted; own-key membership unchecked. |
| TXB-COIN-001 | `coin-selection.ts:181-187` | Same `coinId` selectable twice; no spent/expiry filtering. |
| TXB-FUND-001 | `fund-tx.ts:151-188` | `SignedFundingIntent` replayable; `expectedPoolAddress` optional. |
| TXB-ADDR-001 | `multisig-manager.ts:204-209` vs `rust/src/multisig.rs` | Two contradictory `computeMultisigAddress` outputs; neither a real Mx… MMR address. |
| RM-WITNESS-001 | `witness-adapter.ts:32-41`, `transaction-plan.ts:86-92` | `materializeRecursiveWitness` always returns `mastBranches`; `scriptProofs` optional → proof-less legacy path. |
| DIST-001 | packaging | Local `dist/` stale vs `src` (build hygiene; `dist/` is gitignored, not committed). |
| TXB-SERIALIZE-001 | `core-wasm/src/transaction.rs:399` vs `core/src/transaction.ts` | WASM serializer hardcodes output coinid `0x00`; TS vs WASM tx bytes differ. |

### Low / Info

- **TXB-WITNESS-001** — `witness.ts` serializes without validation (documented).
- **TXB-WOTS-001** — no WOTS key-index reuse tracking.
- **KISSVM-WASM-001** — Rust/TS evaluator parity untested for `CONTAINS` and templates.
- **KISSVM-TEST-001** — kissvm jest mocks `@totemsdk/core` (`wotsVerifyDigest → true`), so signature logic is not exercised by package tests.
- **INFO** — `prevstate` transition metadata strings don't reflect emitted opcodes; `layer.ts` asset layer permissionless but public; RFC-016 §7's "invariant-directed adversarial harness" is only hand-written `toContain` assertions.

---

## 3. Cross-package integration findings

1. Template emits `MAST <root>` then relies on checks that may be after the terminal
   op (sensor/firmware/identity), or emits layers ending `RETURN` before `MAST`
   (composition) — `RM-COMPOSE-001`.
2. `compileMastTree` ScriptProofs are byte-consistent with `verifyScriptProof`/
   `evalProof` in source (leaf equality verified 1–12 leaves) — a genuine
   improvement.
3. The witness plan keeps `scriptProofs` optional, so
   `materializeRecursiveWitness` can produce a proof-less witness the VM accepts
   via `mastBranches` (`KISSVM-EVAL-MASTBRANCH-001`).
4. `toEnhancedBuildParams` converts signatures by hex-parsing `Map<string,string>`
   with no cross-check that witness roles match `disclosedScripts`.
5. `MultisigManager` and recursive-mast share no canonical digest/disclosure check.

---

## 4. Test-gap analysis

- Tests assert generated strings (`toContain`) or run in `simulationMode`; no test
  evaluates a composed multi-layer script or a post-MAST statement.
- kissvm jest mocks `wotsVerifyDigest → true`; signature verification is not
  exercised.
- No duplicate-key `MULTISIG` test; no `threshold<=0`/storage-tamper test.
- No test calls `verifySigningRequest`; no nested-field mutation test.
- No end-to-end template → proof → witness → `evaluateScript` with a valid
  multi-leaf MMR proof.
- No canonical-vector agreement test against a Minima node; no dist freshness test.
- No test that the invariant detector rejects the actual anti-patterns.

---

## 5. Production gate

Do not treat `@totemsdk/kissvm` / `recursive-mast` / `tx-builder` as
production-ready until **all** of the following hold (see RFC-018 for the
contract):

- zero open Critical findings;
- zero open High authorization/economic findings on the stable export surface;
- `MULTISIG` proven distinct-key-only, with adversarial tests in both evaluators;
- every recursive/layered/proof chain demonstrated end-to-end with the child
  branch enforced (negative test: sign only layer 1 ⇒ overall false);
- every exported authorizing template has an adversarial negative test executed
  through `evaluateScript` (wrong signer, rewritten STATE, wrong output/token/index,
  selector out-of-range, prev-state replay);
- a canonical MAST vector agrees byte-for-byte with a Minima node for
  `compileMastTree → ScriptProof → evaluateScript('MAST …')`;
- `verifySigningRequest` proven to reject a bad `requesterSignature`; signing
  sessions bind roles to authorized keys and request ids;
- `ready ⇔ threshold unique configured signers` with tests for threshold
  0/negative/oversize, duplicates, unconfigured keys, tampered storage, replay;
- no security-relevant parameter is accepted and silently unused (lint);
- the packaged `dist` is reproducibly built in CI and matches audited `src`.
