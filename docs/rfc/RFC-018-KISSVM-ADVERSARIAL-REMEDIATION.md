# RFC-018: KISSVM / Recursive-MAST / `tx-builder` — Adversarial Remediation

**Status:** Draft — remediation contract (P0 + P1 landed)
**Created:** 2026-09-28
**Authors:** Totem SDK Contributors
**Depends on:** RFC-016 (KISSVM template security hardening), RFC-017 (decision receipt graph)
**Touches:** `@totemsdk/kissvm`, `@totemsdk/recursive-mast`, `@totemsdk/tx-builder`, `@totemsdk/core` (wasm serializer parity)
**Evidence:** [docs/audits/kissvm-recursive-mast-adversarial-2026-09.md](../audits/kissvm-recursive-mast-adversarial-2026-09.md)

---

## 1. Summary

An independent adversarial audit of the hardened surface found **3 Critical, 11
High, 16 Medium** issues. RFC-016 fixed the first-order criticals; this RFC is
the contract for the **second-order composition/verification holes** it left.
Every remediation below ships with a **negative regression test** (adversarial
input must fail) — string-presence assertions are not sufficient.

The audit's three Criticals are confirmed on current `main`:

- **C1 `MULTISIG` counts duplicate keys** → statechain 2-of-2 collapses to 1-of-1.
  **Oracle-verified:** Minima's own C++ `MULTISIG` (`m_u_l_t_i_s_i_g.cpp`) also
  iterates parameters and counts **positions**, with no de-duplication. Changing
  the evaluator would diverge from consensus, so the remediation is
  **template-level only** (commit the owner key via `PREVSTATE` and assert the
  two keys differ). See §7 Open Q1.
- **C2 `toNestedMastScript` appends a terminal `MAST` after `RETURN`** → child
  delegation layers are dead.
- **C3 `stripTrailingReturn` strips `RETURN FALSE`** → an explicit deny becomes
  "authorize + delegate".

---

## 2. Goals

1. Close all Critical and High authorization/economic findings on the stable
   export surface.
2. Make proof/MAST composition fail closed: no branch executes without a verified
   membership proof, and no terminal `MAST` is placed after a `RETURN`.
3. Make signing verification real: `verifySigningRequest` and signing sessions
   must cryptographically verify requester/signer signatures and bind roles.
4. Make the invariant detector an actual gate (structural, not presence-based).
5. Provide the canonical-node and end-to-end tests the production gate requires.

## 3. Non-goals

- Redesigning the template vocabulary.
- Fixing every experimental template's economics in this RFC (P2, tracked).
- Changing the authority/policy trust boundary.

---

## 4. Phases

### P0 — release blockers

| # | Task | Files | Acceptance |
|---|------|-------|------------|
| P0-1 | **Template-level only** — the C++ oracle confirms Minima's `MULTISIG` counts positions (no de-dup), so the evaluator must **not** change. Rewrite statechain to authenticate the committed owner (`PREVSTATE`) with continuity and assert the two keys are distinct | `kissvm/src/templates/statechain.ts` (normal + rotation) | Negative: SE-only ⇒ `false`; `STATE(0)=sePk` ⇒ `false`; rotation `newOwner=sePk` ⇒ `false`. Positive: owner+SE ⇒ `true`. |
| P0-2 | `toNestedMastScript` (both copies) strips **only** a terminal `RETURN TRUE`; fail closed on any other terminal `RETURN`; reject empty chains | `kissvm/src/mast/proof-chain.ts`, `recursive-mast/src/proof-chain.ts` | Negative: layer ending `RETURN FALSE` throws. Positive: inline `RETURN TRUE` still composes. |
| P0-3 | `stripTrailingReturn` (all copies) strips only `RETURN TRUE`; never `RETURN FALSE`; tolerate trailing comments/blank | `recursive-mast/src/layered-policy.ts`, `delegation.ts`, `kissvm/src/mast/layered-policy.ts` | Negative: layer ending `RETURN FALSE` throws when composed. |
| P0-4 | `EXEC MAST` requires inline branch hashes; legacy `mastBranches` gated behind `allowLegacyMastBranches` (default **off**); unrooted `EXEC MAST` fails closed | `kissvm/src/eval.ts`, `types.ts`, `recursive-mast/src/kissvm/simulation.ts` | Negative: `MAST 0xdead` + `mastBranches` ⇒ `false` by default. Positive: opt-in resolves. |
| P0-5 | Fix `RM-ACTION-001`: `actionSelectorPort` must be `> 0` (or subject written after) | `recursive-mast/src/transaction/action-transaction.ts` | Negative: `actionSelectorPort=0` throws. |
| P0-6 | CI builds `dist` before test/publish and asserts freshness (no stale-artifact resolution) | CI / scripts | Satisfied: the `test` job builds the workspace (`verify-workspace.mjs --typecheck`) before running tests. |

### P1 — before any production authorizing use

| # | Task | Files |
|---|------|-------|
| P1-1 | `verifySigningRequest`: require + verify `requesterSignature` over canonical bytes vs `requesterIdentity.subjectPkd`; populate `outputsMatch`; pass `ds.policyRoot` to `branchVerifier`; fail closed on unknown actions | `recursive-mast/src/policy-signing.ts` |
| P1-2 | Signing session / `collectSigningResponses`: verify signatures; bind `requestId`; bind role→authorized key from the manifest; reject self-asserted roles | `recursive-mast/src/{signing-session,policy-signing}.ts` |
| P1-3 | Stable templates: `authority` mandate commits expiry/epoch/scope (or `STATE EQ PREVSTATE`); `buildUsageTrackingScript` gains authorization + committed window; industrial-action notice committed; manifest expiry signed; agent-proposal authorized | `kissvm/src/templates/{authority,industrial-action,manifest,agent-policy}.ts` |
| P1-4 | `tx-builder`: validate threshold (`1 ≤ t ≤ unique(keys)`), reject duplicates/unconfigured keys, stop trusting persisted `validated`, stop clobbering terminal statuses | `tx-builder/src/multisig-manager.ts` |
| P1-5 | `CONTAINS` is **rejected at parse time** (the parser refuses unknown functions). The C++ oracle confirms Minima has no `CONTAINS`, so implementing it would diverge from consensus; the 14 affected experimental templates stay fail-closed until rewritten with consensus constructs | `kissvm/src/parser.ts` | `parseScript('CONTAINS(...)')` throws `/Unknown function/`. |
| P1-6 | Fix experimental economics: treasury counters/clamps, liquid-democracy delegate continuity, optional operator | `kissvm/src/templates/{treasury,voting,state-machine}.ts` |

### P2 — hardening / consistency

| # | Task | Files |
|---|------|-------|
| P2-1 | Replace every raw-SHA3 script-hash helper with `computeCanonicalScriptHash` | `recursive-mast/src/{content-keys,governance,recovery}.ts` |
| P2-2 | `computeRelease`/on-chain parity when `duration<=0`; prevstate workflows end in `RETURN`; migration composes correctly | `kissvm/src/templates/temporal.ts`, `kissvm/src/mast/prevstate.ts`, `recursive-mast/src/migration.ts` |
| P2-3 | Coin-selection dedup + spent/expiry; funding-intent nonce/expiry + required pool address; WASM/TS serializer parity | `tx-builder/src/{coin-selection,fund-tx}.ts`, `core-wasm` |
| P2-4 | Invariant detector: structural AST checks (detect `SIGNEDBY(STATE(…))`), I3 unconditional with per-template declared ports, unreachable-branch awareness | `kissvm/src/invariants.ts` |
| P2-5 | Build the RFC-016 §7 adversarial mutation harness; add a dist provenance test | kissvm tests / CI |

---

## 5. Test requirements (must exist before the gate passes)

- Statechain distinct-key adversarial test: SE-only ⇒ `false`, `STATE(0)=sePk`
  ⇒ `false` (the evaluator is intentionally unchanged — Minima counts positions).
- Two-link composition negative test (sign only layer 1 ⇒ `false`).
- `RETURN FALSE` deny survives composition.
- `EXEC MAST` / `mastBranches` proof-less rejection.
- `verifySigningRequest` rejects a bad `requesterSignature`; nested-field mutation
  test.
- Per-template adversarial negative tests run through `evaluateScript`.
- Canonical MAST vector: `compileMastTree → ScriptProof → evaluateScript('MAST …')`
  agrees with a Minima node (the C++ `totem-node` is available as the oracle).
- `tx-builder` threshold 0/negative/oversize, duplicates, unconfigured keys,
  tampered storage, replay.

---

## 6. Production gate

The gate in the audit (§5) is the acceptance condition for this RFC: zero open
Critical, zero open High authorization/economic on the stable surface, template-level
`MULTISIG` distinctness proven (statechain), end-to-end composed chains with child
enforcement, adversarial per-template tests, a node-agreed canonical MAST vector,
verified signing requests/sessions, sound multisig readiness, no silently-unused
security parameters, and a CI-reproducible `dist`.

---

## 7. Open questions

- **Q1** Should `MULTISIG` de-duplication be consensus-compatible with Minima's
  Java `MULTISIG` (which may also count positions)? Verify against the Java/C++
  source before changing semantics — if Java counts positions too, the fix is in
  the *template* (`PREVSTATE` continuity) rather than the evaluator.
- **Q2** `CONTAINS` — **resolved: reject at parse time.** The C++ node has no
  `CONTAINS`, so implementing it would diverge from consensus. The parser already
  rejects unknown functions (locked by a regression test); the 14 affected
  experimental templates must be rewritten with consensus constructs (P2).
- **Q3** Legacy `mastBranches`: remove entirely, or keep behind an off-by-default
  dev flag?
