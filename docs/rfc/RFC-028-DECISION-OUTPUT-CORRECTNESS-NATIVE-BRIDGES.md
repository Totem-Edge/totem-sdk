# RFC-028: Decision Output Correctness & Native Provider Bridges

**Status:** Draft — design specification
**Created:** 2026-10-01
**Authors:** Totem SDK Contributors
**Reviewers:** [Pending stakeholder assignment]
**Depends on:** RFC-012 (Decision Runtime)
**Touches:** `@totemsdk/decision` (`validation.ts`, `typed-backend.ts`, `runtime.ts`, `adapters/jev.ts`, `adapters/laya.ts`, `types.ts`)

---

## 1. Summary

The Decision runtime's core architecture — bounded proposals, candidate-constrained
validation, explicit escalation, separately governed execution — is sound and
stays. This RFC fixes three concrete output-correctness defects found by offline
probes, and replaces the "host must supply a Totem-shaped client" expectation
with **tested native bridges** for the two first-party providers (Jev and Laya).

Everything here is local to `@totemsdk/decision`. No industrial adapter, no
evidence-model change, and no trust-boundary change.

## 2. Motivation

### 2.1 Three output-validation defects

| # | Defect | Evidence |
|---|---|---|
| V1 | A missing probability output silently becomes `probabilityTrue: 0` and is accepted. Missing output must be an error. | `translateBackendResult` sets `probabilityTrue: p.probabilityTrue ?? 0` (`packages/decision/src/typed-backend.ts:141`). The client path correctly *omits* the field when absent (`typed-backend.ts:443-451`), so the typed-backend `?? 0` fabricates a valid value before validation can reject it. |
| V2 | A score is accepted even when `expectedScore` contradicts its own distribution. | `validateProviderDecision` checks `expectedScore` only for finiteness and `[0, rubric.length-1]` range (`packages/decision/src/validation.ts:422-431`); it never checks `expectedScore ≈ Σ index × probability`. |
| V3 | An action expanded into `1 + (#target-bearing operations)` model questions can exceed a provider's `maxQuestions` limit. | Eligibility counts questions only when `request.kind === 'questions'` (`packages/decision/src/runtime.ts:126-136`). Action requests are checked against operation/target limits only. Expansion happens later in `clientQuestionsFromTyped` (`typed-backend.ts:341-360`), after the check. |

### 2.2 The bridge gap

Both shipped adapters (`adapters/jev.ts`, `adapters/laya.ts`) wrap a
host-supplied `DecisionClientLike` whose only method is a Totem-shaped
`predict()` (`packages/decision/src/typed-backend.ts:291-298`). A builder
integrating the real clients must first discover and write the translation from
each vendor's actual interface into that shape — and that translation is where
subtle mapping errors (missing `noul`, wrong score semantics) hide.

The native clients differ from the supplied seam:

- the Jev client exposes a `systemOne()` entry point and returns native answers
  under an `answers` field;
- the Laya HTTP client exposes a `predict()` with a different signature than the
  Totem seam;
- a native **Score** is a fractional expectation, and a categorical `selected`
  label must be derived by an explicit, documented rule — not an implicit argmax
  with no record.

These are **claims to verify and pin** (§9); the design below is written so the
translation is a tested, first-class artifact regardless of the exact signatures.

## 3. Goals

1. Missing required output is an error, never a fabricated default (V1).
2. `expectedScore` is validated against its distribution within a documented
   tolerance; the fractional expectation and the categorical label are both
   preserved (V2).
3. The effective compiled question count — including action expansion — is
   enforced against provider/route limits **before** invocation (V3).
4. First-class, tested native bridges for Jev and Laya, with an explicit
   translation and an explicit label-derivation rule.
5. Structured instructions and explicit true/false descriptions survive
   compilation and remain digest-bound.
6. Execution metadata (returned model revision, routing detail, token usage) is
   preserved, including from failed/rejected attempts; lifecycle operations are
   forwarded.

## 4. Non-goals

- Per-question acceptance and multi-provider assembly — RFC-029.
- Richer preflight (token/option-description budgets, checkpoint selection) and
  shortlisting/batching — RFC-030.
- Any change to `authorizeAndReserve` or the edge runtime.
- Replacing the existing generic `DecisionClientLike` seam (it is retained for
  hosts that already provide a Totem-shaped client).

## 5. Design

### 5.1 V1 — missing probability output is an error

Remove the fabricated default. A probability answer must carry an explicit value,
from either `probabilityTrue` (typed backend) or the provider field
(`probabilityField`, client path):

```ts
// typed-backend.ts translateBackendResult, probability branch
if (typeof p.probabilityTrue !== 'number') {
  throw new DecisionError(
    'INVALID_OUTPUT',
    `Provider produced no probability output for question "${q.id}".`,
  );
}
```

`createTypedDecisionProvider` already converts a thrown translation error into a
`PROVIDER_ERROR` outcome (`typed-backend.ts:232-241`), which the runtime records
as a failed attempt and escalates past — the correct behaviour for a missing
required output.

The client path is already correct (`typed-backend.ts:443-451`); the fix is to
make the typed path match it. A provider that legitimately means "0" must return
`0`, not omit the field — the distinction is the whole point.

### 5.2 V2 — validate `expectedScore` against its distribution

When both a complete distribution and an `expectedScore` are present, the two
must agree. Indices are the rubric positions (zero-based, ordered increasing):

```ts
/** In validateProviderDecision's score branch, after distribution validation. */
if (distribution && expectedScore !== undefined && raw.complete === true) {
  const ids = candidateIdsOf(question);
  const implied = ids.reduce(
    (acc, id, index) => acc + index * (distribution[id] ?? 0),
    0,
  );
  if (Math.abs(implied - expectedScore) > scoreTolerance(ids.length, options)) {
    throw new DecisionError(
      'INVALID_DISTRIBUTION',
      `expectedScore ${expectedScore} contradicts the distribution (implied ${implied}).`,
    );
  }
}
```

Rules:

- The check applies only to a **complete** distribution (partial distributions do
  not determine an expectation).
- **Score agreement uses a dedicated `scoreTolerance`, not the distribution-sum
  tolerance.** The two error terms scale differently: if each probability carries
  rounding error `ε`, the sum error is bounded by `n·ε`, while the expectation
  error is bounded by `Σ index·ε` (order `n²·ε/2`). Reusing the distribution
  tolerance would therefore reject mathematically consistent scores on larger
  rubrics. Default: `distributionTolerance × max(1, rubricLength − 1)`,
  overridable per provider via a new `DecisionProviderInfo.scoreTolerance`
  (threaded through `ProviderDecisionValidationOptions`, alongside
  `distributionTolerance` at `runtime.ts:325`).
- The **fractional expectation and the categorical `selected` label are both
  retained** — neither replaces the other.

### 5.3 V2b — explicit, documented `selected` derivation for scores

A native score may report an expectation without a categorical label. The
derivation must be explicit and recorded:

```ts
export type ScoreLabelDerivation =
  | 'provider'      // the client supplied a label; trust it
  | 'argmax'        // derived from the distribution maximum
  | 'nearest-index'; // derived from expectedScore, nearest rubric index
```

The derivation used is carried **on the answer** (`ScoreAnswer.scoreLabelDerivation`)
and is therefore part of `outputDigest` (`canonical.ts`, `computeOutputDigest`).
This is deliberate: a provider-asserted label and a Totem-*derived* label are
materially different evidence, and binding the derivation makes that difference
tamper-evident and auditable. The field is **trusted because validation
recomputes it**, never because a provider reports it — `validateProviderDecision`
must confirm that `provider` labels are among the offered rubric ids, that
`argmax` labels are the distribution maximum, and that `nearest-index` labels
match `expectedScore`; a mismatch is `INVALID_OUTPUT`. `argmax` reuses the
existing `requireArgmax` machinery (`validation.ts:231-243`); `nearest-index` is
used only when no distribution is available.

### 5.4 V3 — enforce the effective compiled question count

The question count a provider actually receives is not
`request.questions.length`. For an action request, `clientQuestionsFromTyped`
emits `1 + (#operations with targets)` questions (`typed-backend.ts:341-360`).
Eligibility must check the **compiled** count.

Add a shared, exported compiler:

```ts
/** Number of native questions a provider will receive for this request. */
export function countCompiledQuestions(request: DecisionProviderRequest): number {
  if (request.kind === 'questions') return request.questions.length;
  return 1 + request.operations.filter((op) => (op.targets ?? []).length > 0).length;
}
```

`checkEligibility` uses `countCompiledQuestions(request)` against
`limits.maxQuestions` for **both** kinds (`runtime.ts:126-146`). This makes the
hard ceiling truthful: a provider declaring `maxQuestions: 2` is no longer handed
a four-question action expansion.

> RFC-030 extends this into a full preflight (tokens, option-description budget,
> rubric size, checkpoint selection). RFC-028 establishes only the correctness
> fix: the count that is enforced equals the count that is compiled.

### 5.5 Native bridge seam

Keep the generic `DecisionClientLike` seam, and add a **native** seam per
provider that translates the vendor's real interface into the existing typed
result. The generic seam stays for hosts already on a Totem-shaped client.

```ts
/** Host-supplied Jev client (structural; verified in §9). */
export interface JevNativeClientLike {
  systemOne(params: {
    readonly model?: string;
    readonly state: DecisionValue;
    readonly questions: readonly DecisionClientQuestion[];
    readonly signal?: AbortSignal;
  }): Promise<{
    readonly answers: Record<string, DecisionClientPrediction> | unknown;
    readonly usage?: DecisionUsage;
    readonly requestId?: string;
    readonly raw?: unknown;
  }>;
}

/** Host-supplied Laya HTTP client (structural; verified in §9). */
export interface LayaHttpClientLike {
  predict(params: {
    readonly model?: string;
    readonly context: DecisionValue;
    readonly queries: readonly DecisionClientQuestion[];
    readonly signal?: AbortSignal;
  }): Promise<{
    readonly data: Record<string, DecisionClientPrediction> | unknown;
    readonly routing?: Record<string, unknown>;
    readonly usage?: DecisionUsage;
    readonly requestId?: string;
  }>;
}
```

Each native adapter provides an `adapt*Native()` function that maps the vendor
payload to `DecisionClientResult`, which the existing `createClientDecisionProvider`
already consumes. No new runtime path; only a tested translation.

### 5.6 Native output mapping

| Native output | Totem output | Notes |
|---|---|---|
| `choice` + label probabilities | `selected` + `probabilities` | Distribution validated for coverage/sum; `selected` per derivation rule |
| `score` + numbered level probabilities | `expectedScore` + distribution mapped to rubric IDs | Keep **both**; validate agreement (§5.2) |
| `noul` | `probabilityTrue` | Absence is an error (§5.1) |

Mapping is by **rubric ID**, not by ordinal position, so a reordered rubric
cannot silently remap levels. Level numbers are mapped through the compiled
rubric order recorded in the request.

### 5.7 Structured instructions and true/false descriptions

Jev supports richer question shapes than a bare candidate list. Compilation must
preserve (and digest-bind) semantic fields rather than dropping them:

- `DecisionClientQuestion` gains optional `instruction` and, for probability
  questions, `trueDescription` / `falseDescription`.
- `buildBackendQuestions` already carries `instruction` and candidate metadata
  (`typed-backend.ts:52-68`); the native bridge forwards them.
- Any new semantic field **must participate in `candidateSetDigest` /
  `requestDigest`** (computed over the canonical request, `canonical.ts:98-104`),
  so a change to an instruction or a true/false description changes the digest
  and cannot be attributed to the original request.

### 5.8 Retaining execution metadata (including failures)

Provenance currently carries provider/model/runtime/locality/upstream id
(`types.ts:287-295`). Extend retention, without overloading trusted fields:

- **Model revision:** keep populating `DecisionModelRef.revision`
  (`types.ts:268-274`) from provider-reported data, with `provenance` marked
  `provider-reported` (never `verified` unless actually checked).
- **Laya routing detail:** retain provider-reported routing context (e.g.
  checkpoint/language/task selection) under a new optional
  `DecisionUsage.metadata` entry (`types.ts:298-302`, already a
  `Record<string, number|string>`) or a dedicated provider metadata field — not
  in trusted top-level fields.
- **Usage from failed/rejected attempts:** `DecisionAttempt` (`types.ts:348-360`)
  gains optional `usage?: DecisionUsage`. The runtime records usage returned with
  an unsuccessful-but-billable outcome before escalating (`runtime.ts:302-319`).
- **Provider-level usage** remains on `DecisionSuccess.usage`
  (`types.ts:387`).

No provider may populate bindings, receipts or `accept` — unchanged.

### 5.9 Lifecycle forwarding

`DecisionProvider` already declares optional `cancel`/`close`
(`types.ts:489-490`). The native bridges must forward these to the underlying
client when it exposes them, preserving the runtime's hard-cancellation contract
(`runtime.ts:233-239, 444-453`). A native client without cancellation keeps the
current best-effort behaviour (abort the wait, no provider cancel).

## 6. Compatibility

- V1/V2/V3 are strictness increases. A provider that previously passed by
  fabricating `0`, by an inconsistent `expectedScore`, or by over-limit action
  expansion will now fail — this is intended and is a `0.x` breaking change.
- The generic `DecisionClientLike` seam is unchanged; native bridges are
  additive.
- New `DecisionAttempt.usage` and `DecisionUsage.metadata` keys are optional.

## 7. Security considerations

| Case | Behaviour |
|---|---|
| Provider omits a required output | `INVALID_OUTPUT`; attempt fails and escalates; never a fabricated default. |
| Provider injects an inconsistent `expectedScore` | Rejected by the distribution-agreement check. |
| Action expansion exceeds a declared limit | Ineligible before invocation; recorded as a skipped attempt with `LIMIT_EXCEEDED`. |
| Label derivation unclear | Explicit `ScoreLabelDerivation` recorded; no silent argmax. |
| Semantic field mutated in flight | Digest changes; the request no longer matches the recorded bindings. |
| Provider claims `verified` provenance | Never trusted; provenance stays `declared`/`provider-reported` unless actually verified. |

## 8. Implementation plan

- **P0 — Correctness fixes.** V1 (remove `?? 0`), V2 (`expectedScore` agreement),
  V2b (`ScoreLabelDerivation`), V3 (`countCompiledQuestions` in eligibility).
- **P1 — Native bridge seam.** `JevNativeClientLike`, `LayaHttpClientLike`,
  `adapt*Native` translation to `DecisionClientResult`.
- **P2 — Mapping fidelity.** Rubric-ID mapping, `selected` derivation, structured
  instructions + true/false descriptions in the digest preimage.
- **P3 — Metadata.** `DecisionAttempt.usage`, model revision, Laya routing detail,
  lifecycle forwarding.
- **P4 — Tests.** Native request/response **fixtures** (offline, checked in);
  offline Laya integration test; opt-in live Jev checks (host-gated, not CI);
  regression tests for V1/V2/V3; digest-stability tests for semantic fields.

## 9. External dependencies to verify and pin

> The following are **claims from the originating review**, not established
> facts. No bridge ships until each is confirmed against the real client and the
> version/commit is pinned.

| Claim | Verification task |
|---|---|
| The Jev client uses a `systemOne()` entry point and returns answers under `answers` | Confirm method name, request/response shapes, error model |
| The Laya HTTP client's `predict()` has a different signature than the Totem seam | Capture the exact signature and map it |
| A native score is a fractional expectation plus numbered level probabilities | Confirm semantics; fix the rubric-ID mapping |
| Jev supports structured instructions and explicit true/false descriptions | Confirm capability and field names |
| Laya exposes routing detail (checkpoint/language/task) | Confirm fields; scope §5.8 retention |
| Both clients expose lifecycle (cancel/close) | Confirm; otherwise keep best-effort cancellation |

## 10. Open questions

- **Q1** *Resolved:* native bridges live in `@totemsdk/decision` beside the
  existing adapters (one tested translation surface; split into
  `@totemsdk/decision-jev`/`-laya` only if vendor specifics grow).
- **Q2** *Resolved:* score agreement uses a dedicated, rubric-size-aware
  `scoreTolerance` (§5.2), not the distribution-sum tolerance.
- **Q3** *Resolved:* `ScoreLabelDerivation` lives on the answer and is
  digest-bound (§5.3); validation recomputes it before it is trusted.
- **Q4** Are fixtures permitted to embed real provider payloads, or must they be
  synthetic-but-shape-accurate?

## 11. References

- `docs/rfc/RFC-012-DECISION-RUNTIME.md` — architecture this preserves
- `docs/rfc/RFC-021-INDUSTRIAL-CATALOGUE-DECISION-BINDING.md` — consumer of candidates (amended by Amendment A)
- `docs/rfc/RFC-029-PER-QUESTION-ACCEPTANCE-MULTI-PROVIDER.md` — next in series
- `docs/rfc/RFC-030-MODEL-AWARE-PREFLIGHT-SHORTLISTING-BATCHING.md` — preflight/shortlisting/batching
- `packages/decision/src/{validation,typed-backend,runtime,types,canonical}.ts`
- `packages/decision/src/adapters/{jev,laya}.ts`
