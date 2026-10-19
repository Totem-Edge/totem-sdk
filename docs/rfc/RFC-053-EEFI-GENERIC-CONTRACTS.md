# RFC-053 — Eefi Generic Contracts (v1)

Status: Draft — implementation authorised for the `@totemsdk/eefi` generic contract surface only
Created: 2026-10-19
Authors: Totem SDK Contributors
Depends on: RFC-048 (Omnia Primitive Completeness), RFC-049 (MASH × Omnia × Eefi), RFC-050 (Eefi Product Architecture), RFC-051 (AI-Proposed Committed Facts)
Touches: **new** `@totemsdk/eefi`; references (does not modify) `kissvm`, `proof`, `edge`, `omnia`

> **Scope.** RFC-050 defines the Eefi boundary and explicitly authorises no implementation
> (§12). This RFC makes the **generic contract surface** in RFC-050 §5 concrete and authorises
> exactly one package — `@totemsdk/eefi` — containing schemas, canonical digests and
> fail-closed validation. It authorises **no** product terms, script builders, policy engines
> or money movement.

---

## 1. Why a package

The generic Eefi contracts are cross-cutting: capital terms bind `omnia`, quotes bind `edge`,
risk policy binds `agent-policy`, and exercise descriptors bind `kissvm`. Placing them in any
one of those packages would either create a dependency cycle (`omnia → kissvm`, `edge →
agent-policy`) or duplicate "shadow" types and digests.

`@totemsdk/eefi` is therefore a **neutral schema root**:

- It depends only on `@totemsdk/core` (canonical JSON + SHA3-256).
- It MUST NOT import `edge`, `omnia`, `kissvm`, `agent-policy`, `proof` or `tx-builder`.
- It performs no money movement, script construction or policy evaluation.
- Product-specific terms (strikes, tranche waterfalls, credit schedules) are out of scope
  (RFC-050 §1, §12).

This also gives the surface independent versioning (`eefi-*/v1`) without churning the
safety-critical VM or the execution layer.

## 2. Enforcement stays below Eefi

| Concern | Home | Notes |
|---|---|---|
| Contract schemas, digests, validation | `@totemsdk/eefi` | this RFC |
| P-EXIT / collateral / oracle / membership covenant builders | `@totemsdk/kissvm` | generic script construction; reused by non-Eefi domains |
| Oracle policy / quorum runtime | `@totemsdk/proof` | OMP-18/19 |
| Signed negotiation and quote canonicalisation | `@totemsdk/edge` | one financial message envelope |
| Channel funding, updates, settlement | `@totemsdk/omnia` | execution |

The P-EXIT **descriptor** (`EefiExerciseCovenant`) lives in `eefi`; the **builder**
(`buildExerciseCovenant`) stays in `kissvm`. Moving builders into Eefi would invert the
dependency direction and force provider-bond/factory/statechain users to depend on the product
layer. A future `@totemsdk/eefi/kissvm` subpath MAY provide descriptor→builder adapters with a
peer dependency on `kissvm`; it is not part of v1.

## 3. Contracts (v1)

All hex values are `0x`-prefixed, even-length. All amounts are non-negative integer strings in
atoms (never floats). Basis points are integers in `[0, 10000]`.

### 3.1 `EefiCapitalAgreement` (`eefi-capital/v1`)

| Field | Type | Meaning |
|---|---|---|
| `version` | `'eefi-capital/v1'` | schema tag |
| `termsHash` | hex | digest of `{ funding, operation, settlement }` |
| `funding.mashPolicyRoot` | hex | MSHS-2 policy root authorising entry |
| `funding.allowedProgramHash` | hex | exact Omnia program the capital may fund |
| `funding.assetId` | hex | asset (`0x00` = native Minima) |
| `funding.maxAmountAtoms` | atoms | maximum deployable |
| `funding.counterparties?` | string[] | allow-list; absent ⇒ permissionless |
| `operation.channelProgramId` | string | Omnia program identifier |
| `operation.maturityBlock` | block | maturity/expiry |
| `operation.stateRulesHash` | hex | committed state-transition rules |
| `operation.conditionPolicyId?` | string | optional condition/oracle policy |
| `settlement.payoutPolicyHash` | hex | exact beneficiary payout path |
| `settlement.recoveryPolicyHash` | hex | fallback / owner recovery |
| `settlement.collateralCommitment?` | hex | optional bond/liquidation commitment |

`termsHash` MUST be recomputed wherever the agreement is enforced; a stored value is never
trusted alone (RFC-050 §5).

### 3.2 `EefiMarketAgreement` (`eefi-market/v1`)

Fields: `version`, `quoteId`, `nonce`, `side` (`buy` | `sell`), `baseAssetId`, `quoteAssetId`,
`baseScale`, `quoteScale`, `exactIn?` XOR `exactOut?`, `priceAtoms`, `feesBps`,
`maxSlippageBps?`, `venue`, `deadlineBlock`, `conditionPolicyId?`, `makerId`, `takerId`,
`domain`, `signatureRef`.

- Exactly one of `exactIn` / `exactOut` MUST be present.
- `quoteId` is the canonical digest of the quote body **excluding `quoteId` and
  `signatureRef`**.
- `signatureRef` points at the signed-negotiation digest (e.g. `edge`
  TradeProposal/TradeAgreement) so the quote can be re-signed without changing its identity.

### 3.3 `EefiRiskPolicyRef` (`eefi-risk/v1`)

Fields: `version`, `policyId`, `maxExposureAtoms`, `collateralRatioBps?`, `haircutBps?`,
`liquidationConditionId?`, `oraclePolicyIds?`.

`policyId` is the canonical digest of the body excluding `policyId`. This is a declarative
policy reference; it never encodes a discretionary engine.

### 3.4 `EefiExerciseCovenant` (`eefi-exercise/v1`)

Fields: `version`, `kind` (`unilateral-exercise` | `liquidation` | `maturity-redemption`),
`conditionId`, `beneficiaryPolicyHash`, `recoveryPolicyHash`, `timelockBlocks`.

This is the P-EXIT descriptor. The objective condition is enforced on-chain by the
corresponding `kissvm` template; the descriptor commits the condition and the exact
beneficiary/recovery paths.

## 4. Canonical digests

All digests reuse `@totemsdk/core`'s canonical JSON (sorted keys) and SHA3-256:

```
digest(domain, value) = '0x' || sha3_256(domain || canonicalJson(stripUndefined(value)))
```

Domains are versioned and disjoint:

| Domain | Covers |
|---|---|
| `eefi:capital-terms:v1` | `{ funding, operation, settlement }` |
| `eefi:market-quote:v1` | market body minus `quoteId`, `signatureRef` |
| `eefi:risk-policy:v1` | risk body minus `policyId` |
| `eefi:exercise-covenant:v1` | whole exercise descriptor |

`undefined` optional fields are stripped recursively so an absent field and an explicitly
`undefined` field produce the same digest.

Public helpers: `eefiCapitalTermsHash`, `eefiMarketQuoteDigest`, `eefiRiskPolicyId`,
`eefiExerciseCovenantHash`.

## 5. Validation (normative)

Validation is fail-closed and throws `EefiValidationError` with a list of issues. It MUST
check:

1. the version tag and required fields;
2. hex shape (`0x`, even length), atom strings, basis-point ranges;
3. exactly one of `exactIn` / `exactOut`;
4. that `termsHash` / `quoteId` / `policyId` equal their canonical digests.

Unknown versions are rejected. Validation does not evaluate economics, signatures or
enforcement; those belong to the owning lower layers.

## 6. Versioning

- Every digested schema change REQUIRES a new version tag (`/v2`). This includes adding an
  optional field that participates in the digest.
- A consumer MUST reject unknown versions rather than best-effort parse them.
- Domain strings are part of the wire contract and MUST NOT be reused across versions.

## 7. Conformance

- Package unit tests cover digest determinism, key-order independence, domain separation,
  exclusions, and rejection of malformed units/hex/ids.
- The package is registered in `SDK_MANIFEST.json` under the `programmable-capital` domain and
  in the MCP symbol index.
- End-to-end Eefi conformance (MASH treasury → conditional funding → unilateral close →
  vault reconciliation) is RFC-054, not this RFC.

## 8. Non-goals

- Product terms and product-level protocols (derivative maths, margin engines, AMMs,
  auctions, netting).
- Covenant builders and script syntax (RFC-048 / `kissvm`).
- Oracle policy runtime (`proof`), negotiation transport (`edge`), execution (`omnia`).
- Custody, key management, or any movement of value.

## 9. Open questions

1. Should `EefiCapitalAgreement` reference a **specific** Omnia program version, or a program
   hash that can be superseded by a governed upgrade? (Current: hash only.)
2. Should `EefiMarketAgreement` commit the fee recipient explicitly, or is that part of
   `signatureRef`?
3. Do structured products need a generic `EefiPayoutWaterfallRef` in v2, or is that always a
   product-owned policy hash?
4. Should the future `eefi/kissvm` adapter be a subpath or a separate package?

## 10. Authorisation

This RFC authorises the implementation of `@totemsdk/eefi` v0.1.0: the four contract schemas,
their canonical digests, validation, and the package/test plumbing. It authorises nothing
else. Products, products economics and enforcement remain governed by RFC-050 and RFC-054.
