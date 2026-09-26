# RFC-016: KISSVM Template Security Hardening — Authorization, Economic, State & MAST Invariants

**Status:** In progress — **P0, P1, P2 landed.** P0: audit checked in; invariant helpers + static detector; README unaudited notice. P1: confirmed criticals repaired (statechain/authority/agent-policy/proof/identity/heartbeat/txpow; `VERIFYOUT` binding; fail-open → exhaustive `ELSE RETURN FALSE`; empty policies/chains throw). P2: **canonical MAST only** — `policy-tree.ts`, `proof-chain.ts`, `prevstate.ts`, `layered-policy.ts` (kissvm) and the used `recursive-mast` helpers (`delegation.ts`, `cross-domain.ts`, `migration.ts`) now use `compileMastTree`/`computeCanonicalScriptHash`; `verifyDelegationChain` now actually verifies the MMR proof against the policy root; the witness bridge carries canonical `ScriptProof`s and populates `expectedRoot` (no more discarded `mmrProof`/empty root); empty proof chains throw. **P4 landed (first wave):** temporal linear/cliff vesting commit the schedule (`PREVSTATE` continuity) and clamp at `total` (no over-vest); decay is authorized and bound to the beneficiary output; liquidity-bond fee binds the governance output to `claimable` (provider-signed) and withdrawal pays the provider (not a same-address rollover); provider-bond release pays the provider and records `claimed`, and challenge filing requires a challenger-bond output; capability script refuses an empty permission set; industrial-action reveal preserves the commitment instead of requiring the preimage to pre-exist. **Still open in P4:** `data-privacy` (access-log port conflates retention-timestamp and count), `commercial` (already output-bound on the audited paths; residual review), and `layers` (allow-all/malformed-multisig review) per the audit disposition table.
**P4 (wave 6) landed:** industrial-action escrow is authorized by a fixed `authorityPk` and binds the payout to the `beneficiaryPkd` via `VERIFYOUT` (was a pure metadata check); the reveal fix landed in wave 1.
**P4 (wave 5) landed:** governance proposal cancellation authenticates the committed proposer (`PREVSTATE`), not a mutable current-state value; the WOTS-lease watermark script preserves the committed block marker (the old `SAMESTATE(w+1,w+2)` compared the wrong ports).
**P4 (wave 4) landed:** compliance pipeline stages authenticate committed issuers/actors (`PREVSTATE`), the revocation list is read from `PREVSTATE`, and stage hashes are canonical; sensor proof MASTs the policy root (not the device key) and reads committed freshness (`PREVSTATE`); clinical-trial enrollment/adverse-event, post-market and safety-report counters now advance with their caps enforced.
**P4 (wave 3) landed:** treasury records the period spend and accepts an optional `recipientPkd` that binds the spend output to the recipient; RWA distribution/redemption consume their cumulative counters (caps were previously unenforced); `buildInstitutionalHierarchy` requires real `governancePks` (was emitting `MULTISIG(threshold 0x00 …)` placeholders); delegated credentials consume their usage counter (was reusable indefinitely).
**P4 (wave 2) landed:** voting consumes credits (`STATE(creditsSpent) EQ prevSpent ADD cost` — previously credits were never spent, allowing unlimited votes); device key-rotation accepts an optional `keyPort` and, when set, binds the rotation to the committed old key and the configured new key.
**P5 landed:** `MultisigManager.updateStatus` counts only **validated** signatures from **unique configured** signers (an invalid signature can no longer mark a transaction `ready`); `createPendingTransaction` recomputes/validates the transaction digest (digest comparison normalized); `DeepFundingProof` renamed to `SignedFundingIntent` (deprecated alias kept) with an explicit "signed intent, not on-chain spend" doc; `selectCoins` rejects non-positive targets (`INVALID_TARGET`).
**P3 landed:** `createAnchorTransactionPlan` now locks the output to the Policy Anchor script address (was sending it to `fundingAddress` and ignoring the computed script); root-rotation plans select the anchor rotation/epoch branch and require an `authorizerPkd`; action plans bind the normal-action selector; the cross-domain access-delegation expiry no longer mixes wall-clock ms with `@BLOCK`; cross-domain required attributes use distinct state ports (multi-attribute policies were unsatisfiable); delegation-proof verification and canonical witness materialization landed in P2.
**Created:** 2026-09-26
**Authors:** Totem SDK Contributors
**Reviewers:** [Pending stakeholder assignment]
**Depends on:** RFC-009 (KISSVM signature fidelity), RFC-010/RFC-011 (authority / industrial-action), RFC-014 (consent vs autonomy)
**Audit basis:** `docs/audits/kissvm-template-audit-2026-09.md`
**Touches:** `@totemsdk/kissvm` (templates + `mast/`), `@totemsdk/recursive-mast`, `@totemsdk/tx-builder`

---

## 1. Summary

A source-level security audit of the KISSVM template surface, the recursive-MAST
templates and bridge, and the `tx-builder` transaction-coordination code found
**multiple critical authorization bypasses, unenforced economic invariants, a
split MAST root system, and serious witness/signing integration defects**. The
KISSVM **evaluator** is generally sound; the defects are concentrated in the
**templates** and the **recursive-MAST / tx-builder integration layer**.

This RFC freezes a single security contract for executable policy scripts and
repairs the surface to meet it. It does **not** add new templates; it makes the
existing ones fail closed and binds their claims (authority, payment, state,
transition) to what the VM and the transaction actually enforce.

The existing stable test suite is a **regression** suite run in
`simulationMode`; it is not a security suite. This RFC adds an
**invariant-directed adversarial harness** and treats it as the acceptance gate.

## 2. Motivation

The package guide already states the KISSVM templates have **not been
independently audited** (`packages/kissvm/src/GUIDE.md:113`), while the project
README presents KISSVM as a production package. The audit makes that gap
concrete: several stable templates grant authority or assert payment without
enforcing either. Because these scripts are used as **covenants** (the thing that
authorizes a UTXO spend), a template that is only "metadata-shaped" is a live
authorization bypass, not a documentation bug.

Representative confirmed defects (all reproduced from source during triage):

- **`statechain` reclaim** authenticates the **current** `STATE(owner)` rather
  than the committed `PREVSTATE(owner)` — an attacker sets state = own key and
  signs.
- **`authority.ActionAuthorization`** has **no signature** at all and its nonce
  only needs to differ (`NEQ`), so it can oscillate.
- **`agent-policy.PaymentIntent`** checks `STATE(amount)`/`STATE(recipient)`
  but never `VERIFYOUT` — the outputs can be anything.
- **`proof.ProofDelegation`** takes both signer keys from mutable `STATE`.
- **`provider-bond.Heartbeat`** checks `STATE(probeSigner)` instead of the
  configured probe signer.
- **`txpow.TxPoWValidation`** compares transaction **state values** to
  thresholds and has no authorization; it does not inspect real TxPoW.
- **Experimental/industrial** templates use independent `IF` blocks with no
  `ELSE RETURN FALSE`, so an unmatched selector reaches `RETURN TRUE`.
- **`mast/policy-tree.ts`** commits roots with `SHA3(script)` + a home-grown
  binary Merkle tree, while **`mast/mast-compiler.ts`** uses canonical Minima
  MMR (`mmrLeafExact` / `ScriptMMR` / `calculateProofRoot`) — two incompatible
  `policyRoot` meanings.
- **`recursive-mast.verifyDelegationChain`** never verifies `link.proof` against
  `link.policyRoot` yet sets `chain.verified = true`.
- **`recursive-mast.createAnchorTransactionPlan`** computes the anchor script
  and **never uses it**; the output is sent to `config.fundingAddress`.
- **`tx-builder.MultisigManager`** stores invalid signatures and computes
  readiness from `signatures.size`, not from validated, unique, configured
  signers; the local-create path does not recompute the tx digest.

## 3. Goals

- One **security contract** (four invariants, §4) that every executable branch
  satisfies or is explicitly marked permissionless.
- Repair all **critical** and **high** findings in `kissvm` templates,
  `recursive-mast`, and `tx-builder`.
- **One canonical MAST root/proof system** everywhere.
- **Canonical witnesses**: recursive plans carry real `ScriptProof`s and never
  discard MMR proofs or substitute leaf hashes for roots.
- **Fail-closed defaults**: empty/malformed policies and unmatched branches
  return `FALSE`.
- An **invariant-directed adversarial test harness** that is the gate for
  template changes.
- Honest naming: names that overclaim (`DeepFundingProof`,
  `buildTxPoWValidationScript`) are renamed or re-specified.

## 4. The security contract (normative)

Every generated script that can authorize a spend MUST satisfy all four
invariants. Each invariant has a canonical helper that templates should use
rather than hand-rolling.

### I1 — Authorization invariant

> Every executable branch authenticates a **fixed** or **previously committed**
> authority, or explicitly declares itself **permissionless**.

- Authorities MUST NOT be derived solely from mutable current `STATE`. Use a
  constructor-configured key, `PREVSTATE(port)`, or a committed policy member.
- `SIGNEDBY(x)` where `x = STATE(port)` is a violation unless the branch also
  `ASSERT`s `STATE(port) EQ PREVSTATE(port)` (continuity) and the previous value
  was itself authenticated.
- Permissionless branches MUST be explicit (a named, reviewed
  `PERMISSIONLESS` marker in the builder) and surfaced in the template metadata.

### I2 — Economic invariant

> Anything named payment, fee, escrow, release, distribution, redemption, or
> withdrawal MUST bind the **actual transaction output** with `VERIFYOUT`
> (or equivalent output inspection).

- `@AMOUNT`/`@ADDRESS`/`@TOKENID` describe the **input** coin and are not a
  payment check.
- A payment clause must assert the output's address, amount, token, and
  conservation (`VERIFYOUT(@INPUT …)` or a successor-output check), with an
  explicit change rule.
- Claims carried in `STATE` (amount, recipient, fee) are inputs to the check,
  never a substitute for it.

### I3 — State invariant

> Immutable commitments use `PREVSTATE`/`SAMESTATE`; transition state has an
> **exact old → new** relation.

- Scheduled/immutable parameters (start/end/total, owner, policy roots) MUST be
  preserved (`STATE(p) EQ PREVSTATE(p)`) or changed only by a branch that is
  itself authorized.
- Transactions MUST NOT be able to alter the rule that governs them.

### I4 — Fail-closed invariant

> Independent conditional authorization blocks are forbidden. Authorization is
> an **exhaustive selection** with `ELSE RETURN FALSE`.

- `IF … ENDIF` chains that can fall through to `RETURN TRUE` are violations.
- Empty or malformed policies MUST fail **construction**, not compile to
  allow-all (`RETURN TRUE`).

### 4.1 Canonical helper primitives (new, in `kissvm`)

```ts
authorizeFixed(keyHexOrPrevStatePort): string     // SIGNEDBY(fixed | PREVSTATE(port))
assertStateUnchanged(port): string                 // ASSERT STATE(p) EQ PREVSTATE(p)
assertMonotonic(port): string                      // ASSERT STATE(p) GT PREVSTATE(p)
payExact(addressPkOrStatePort, amountExpr, tokenExpr): string  // VERIFYOUT-bound
branch(selector, cases, elseReturnFalse = true): string         // exhaustive IF/ELSEIF/ELSE
assertNonEmpty(items, label): void                 // constructor-time fail-closed
```

Templates are re-expressed on these helpers so the invariants are enforced by
construction and visible in review.

## 5. Confirmed finding → remediation matrix

Legend: **[C]** critical, **[H]** high, **[M]** medium. "V" = reproduced from
source during triage; "A" = audit-reported, not independently re-run.

### 5.1 `kissvm` stable templates

| Template | Sev | Defect | Remediation |
|---|---|---|---|
| `statechain.buildStatechainScript` (reclaim) | C/V | `SIGNEDBY(STATE(owner))` post-timelock | use `SIGNEDBY(PREVSTATE(owner))`; require owner continuity; test attacker state substitution |
| `authority.buildActionAuthorizationScript` | C/V | no signature; nonce `NEQ` (oscillating) | add fixed/prev-state authority; `assertMonotonic(nonce)`; bind `actionHash` to committed action |
| `agent-policy.buildPaymentIntentScript` | C/V | no `VERIFYOUT`, no signer | bind amount/recipient/token to actual output via `payExact`; add authorized signer; `PREVSTATE` continuity |
| `proof.buildProofDelegationScript` | C/V | both keys from `STATE` | derive from `PREVSTATE`/configured authority; authenticate delegator against committed membership |
| `provider-bond.buildHeartbeatScript` | C/V | configured `probeSignerPk` unused; key from `STATE` | `ASSERT SIGNEDBY(configuredProbeSigner)`; if omitted, declare permissionless explicitly |
| `txpow.buildTxPoWValidationScript` | C/V | validates `STATE` claims, no auth/introspection | rename to **attested TxPoW metadata constraint**; require a trusted attestor signature; or gate on real TxPoW introspection if/when exposed |
| `identity.buildDelegationProofScript` | C/A | state-preserving but unauthenticated | add delegator signature bound to committed authority |
| `industrial-action` escrow/reveal | C/A | escrow has no signer/beneficiary/`VERIFYOUT`; reveal preimage logic wrong | re-express escrow via `payExact` + release condition; fix reveal to compare across old→new, not `SAMESTATE(p,p)` |
| `temporal` decay / rate-limit | C/A | decay `value` unused; rate-limit period not implemented | bind computed `value` to an output; implement actual period reset or remove the claim |
| `temporal` linear/cliff vesting | H/A | schedule read from `STATE`; not capped at `vestEnd` | `assertStateUnchanged` for start/end/total; clamp vested ≤ total |
| `provider-bond` challenge/release | H/A | input amount ≠ challenger bond; treasury/reward unused; release rolls to self | bind challenger bond as an output; use `treasuryPk`/`challengerRewardBps`; release pays provider |
| `liquidity-bond` fee/withdrawal | H/A | `@AMOUNT` (whole input) used as fee; withdrawal recreates coin at same address | express fee as output; withdrawal pays the provider address |
| `manifest` | H/A | fail-open empty permissions / continuity | enforce non-empty permissions at construction; continuity on role state |
| `commercial`, `compliance`, `data-privacy`, `device-lifecycle`, `healthcare`, `recovery`, `rwa-lifecycle`, `sensor-proof`, `treasury`, `voting`, `governance`, `wots-lease`, `layers` | H/A | per-family economic/state/output bugs; `layers` allow-all/malformed multisig | per-template remediation in P4 using the §4 helpers; `layers` empty → construction error |
| `eltoo`, `firmware-update`, `payment-channel`, `lookup-protocol`, `state-machine` | M/A | no outsider bypass found; semantics/permissionless mode to review | document permissionless modes explicitly; targeted review |

### 5.2 `recursive-mast`

| Area | Sev | Defect | Remediation |
|---|---|---|---|
| `delegation.verifyDelegationChain` | C/V | never verifies `link.proof` vs `policyRoot`; sets `verified=true` | verify each link's canonical MMR proof against its root; propagate failure; never mutate to `verified` on structural-only match |
| `delegation.toDelegationChainScript` (empty) | C/V | `links.length === 0 → RETURN TRUE` | throw at construction; require ≥1 link |
| access-control / identity-verification `MAST <operatorPk>` | H/A | proves against `policyRoot` but executes `MAST <pk>` (pk ≠ root) | compute `MAST <policyRoot>` from the canonical compiler; keep key as `SIGNEDBY`, not the MAST operand |
| delegation expiry `Date.now()+86400000` vs `@BLOCK` | H/A | wall-clock ms compared to block height | use a block-height expiry or an explicit wall-clock op; never mix |
| cross-domain required attributes | H/A | one state port asserted equal to multiple distinct values | allocate distinct ports per attribute |
| witness bridge (`RecursiveWitnessPlan` / `toEnhancedBuildParams`) | C/V | discards `mmrProof`; keys branches by leaf hash; `expectedRoot: ''` | `recursive-mast/src/kissvm/witness-adapter.ts`, `src/transaction/transaction-plan.ts`: carry real `ScriptProof`s; key by requested root; populate `expectedRoot` |
| `createAnchorTransactionPlan` | C/V | anchor script computed then ignored; output → `fundingAddress` | output address = `address(buildPolicyAnchorScript(...))`; carry the script descriptor |
| `createRootRotationTransactionPlan` / `createActionTransactionPlan` | H/A | imported authorizers unused; action/subject not bound | wire authorizers; populate the anchor action selector/argument fields from `action`/`subjectId` |

### 5.3 MAST roots

The dual-root pair exists **in both packages** — `kissvm/src/mast/` and
`recursive-mast/src/` each ship a `policy-tree.ts` (SHA3 + home-grown binary
Merkle) alongside a `mast-compiler.ts` (canonical MMR). Every consumer of
`policyRoot` must converge on the canonical compiler.

| Area | Sev | Defect | Remediation |
|---|---|---|---|
| `{kissvm,recursive-mast}/src/{mast/,}policy-tree.ts` | H/V | `SHA3` + home-grown binary Merkle root competes with canonical MMR | **delete/deprecate**; `compileMastTree()` is the single root/proof authority |
| `policy-tree.buildLayeredMastScript({layers: []})` | C/V | empty policy → `RETURN TRUE` (allow-all) | throw at construction on empty layers |
| mixed root consumers (`buildLayeredPolicy` vs `verifyProofChain`) | H/V | one package, two root meanings | unify on the compiler; migration note + version bump |

### 5.4 `tx-builder`

| Area | Sev | Defect | Remediation |
|---|---|---|---|
| `MultisigManager.addOwnSignature` / `updateStatus` | H/V | invalid signatures stored; readiness = `signatures.size` | count only `validated === true` from **unique configured** signers toward `threshold` |
| `MultisigManager.importTransaction` | H/V | inserts unverified sigs; no signer-set membership check | reject unverified; require configured signer; then count |
| `MultisigManager.createPendingTransaction` | H/V | no `SHA3(transactionHex) == transactionDigest` check | recompute digest (match the import path) |
| `fund-tx` / `DeepFundingProof` | H/semantic | proves a **signed intent**, not an on-chain funding spend | rename to `SignedFundingIntent`; require independently verified on-chain spend evidence at acceptance |
| `selectCoins` negative target | M | `-1` → `selectedCoins=[]`, `insufficientFunds=false` | reject non-positive targets |

## 6. Root cause

One mistake recurs: **mutable current `STATE` is treated as authority, as
economics, and as immutability, with no binding to the committed past
(`PREVSTATE`), the signer set, or the actual transaction outputs (`VERIFYOUT`)**.
The integration layer repeats it — proofs are dropped or rooted twice, and
readiness tracks signature presence rather than validity. The §4 invariants are
the fix at the source; the adversarial harness (§7) is how we keep it fixed.

Consent vs autonomy (RFC-014 §6.4) sharpens the stakes: the unauthenticated
`PaymentIntent`/`ActionAuthorization` templates are the **autonomy** seams — if
they ever back an agent without a human approval, the defect is a live bypass.

## 7. Invariant-directed adversarial test harness (the gate)

A new suite (`@totemsdk/kissvm/testing` or `src/__tests__/adversarial/`) that,
for every template, deterministically mutates the transaction and asserts it
**fails**:

- signer identity (wrong signer, attacker-selected `STATE` authority, missing
  signature);
- recipient, amount, and token of the **actual outputs** (I2);
- every protected state port (immutability, exact old→new) (I3);
- transition/branch selectors, including out-of-range values (I4);
- policy construction with empty/malformed inputs (I4);
- canonical MAST proofs: tampered `mmrProof`, wrong `policyRoot`, leaf-hash
  substituted for root, dropped proof;
- multisig: invalid signature, duplicate signer, unconfigured signer, threshold
  met by invalid sigs, digest mismatch.

Each template declares its invariant expectations; the harness fails if a
mutation that should be rejected is accepted. `simulationMode`-only "happy path"
tests remain, but they are no longer the gate.

## 8. Compatibility & migration

- **Additive helpers**; template behavior changes are **breaking** where a
  previously-passing transaction now fails closed. Ship with a major/minor bump
  per package and a migration note in each `GUIDE.md`.
- **MAST root convergence is breaking**: legacy `policy-tree` roots are not
  canonical MMR roots. Provide a one-time migration utility that recomputes
  roots with `compileMastTree()` and a deprecation window; the old module is
  removed in the following major.
- **Rename** `DeepFundingProof → SignedFundingIntent` and
  `buildTxPoWValidationScript → buildAttestedTxPoWMetaScript` with deprecated
  aliases for one release.
- Update `README`/`GUIDE` to state clearly: **stable templates are not
  audited; do not ship unchanged** until this RFC lands.

## 9. Phases

- **P0** — land the audit doc; mark templates unaudited in README/GUIDE; add the
  §4 helper primitives and the §7 harness skeleton (failing-first).
- **P1** — fix the confirmed criticals: `statechain`, `authority`,
  `agent-policy`, `proof`, `provider-bond` heartbeat, `txpow` (rename/spec),
  fail-open branches (energy/BoL/legal), empty-policy allow-all.
- **P2** — MAST convergence: delete `policy-tree` roots, unify on
  `compileMastTree()`; fix witness `ScriptProof` construction and `expectedRoot`.
- **P3** — recursive transaction integration: anchor output locking, root
  rotation/action binding, delegation proof verification and expiry units.
- **P4** — high-severity template families (`temporal`, `liquidity-bond`,
  `provider-bond` economics, `manifest`, `layers`, `commercial`, `compliance`,
  `data-privacy`, `device-lifecycle`, `healthcare`, `recovery`, `rwa-lifecycle`,
  `sensor-proof`, `treasury`, `voting`, `governance`, `wots-lease`).
- **P5** — `tx-builder` multisig validity/digest counting; `fund-tx` rename;
  negative-target validation.
- **P6** — flip the harness to required in CI; `GUIDE`/README finalization;
  remove deprecated aliases in the next major.

## 10. Resolved decisions

- The four invariants (§4) are the security contract; templates are
  re-expressed on canonical helpers.
- **Canonical MAST only**: `compileMastTree()` is the single root/proof
  authority; the home-grown Merkle root is deprecated and removed.
- Witnesses carry real `ScriptProof`s; MMR proofs are never discarded and leaf
  hashes are never substituted for roots.
- Empty/malformed policy construction fails closed.
- Multisig readiness counts only validated, unique, configured signatures.
- Names that overclaim are renamed, not defended.
- The adversarial harness — not the happy-path suite — is the acceptance gate.

## 11. Open questions

- **Q1** Is real TxPoW introspection reachable from KISSVM (so
  `TxPoWValidation` can be made a true check), or does it stay an
  attested-metadata constraint with a trusted attestor?
- **Q2** Which template families are actually exposed on the **stable** export
  surface (`src/index.ts`) vs experimental-only? The disposition and rename
  budget depend on this.
- **Q3** For `permissionless` branches, what is the canonical marker/metadata so
  review and the harness can enforce explicitness?
- **Q4** Does `recursive-mast` warrant an independent package version bump and
  deprecation window for its witness format, or a clean break?
- **Q5** Should the four invariants be surfaced as template metadata (machine
  readable) so the harness keys off declarations rather than duplicated logic?

## 12. References

- `docs/audits/kissvm-template-audit-2026-09.md`
- `packages/kissvm/src/GUIDE.md`, `packages/kissvm/src/templates/*`,
  `packages/{kissvm,recursive-mast}/src/{mast/,}policy-tree.ts`,
  `packages/{kissvm,recursive-mast}/src/{mast/,}mast-compiler.ts`
- `packages/recursive-mast/src/{delegation.ts,transaction/anchor-transaction.ts,transaction/transaction-plan.ts,kissvm/witness-adapter.ts}`
- `packages/tx-builder/src/{multisig-manager.ts,fund-tx.ts}`
- RFC-009, RFC-010, RFC-011, RFC-014
- Minima KISSVM semantics: transaction inputs/outputs/state are distinct;
  `VERIFYOUT` is the covenant-output check.
