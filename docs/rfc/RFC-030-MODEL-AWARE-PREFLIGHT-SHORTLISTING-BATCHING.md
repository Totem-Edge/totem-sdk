# RFC-030: Model-Aware Preflight, Shortlisting & Batching

**Status:** Draft — design specification
**Created:** 2026-10-01
**Authors:** Totem SDK Contributors
**Reviewers:** [Pending stakeholder assignment]
**Depends on:** RFC-012 (Decision Runtime), RFC-028 (Output Correctness & Native Bridges), RFC-029 (Per-Question Acceptance & Multi-Provider Assembly)
**Touches:** `@totemsdk/decision` (`runtime.ts`, `types.ts`, `validation.ts`, `typed-backend.ts`)

---

## 1. Summary

Decision's routing checks a few hard limits (`maxQuestions`, `maxCandidates…`)
before invoking a provider (`packages/decision/src/runtime.ts:94-149`), and it
deliberately defers candidate shortlisting and cross-state batching (the
`DecisionShortlister` interface exists but is not invoked,
`packages/decision/src/types.ts:567-579`). RFC-028 already makes the enforced
question count equal the compiled count.

This RFC turns that check into a **model-aware preflight** against the *compiled*
request: actual question count, token requirements, option-description budget and
supported rubric size — with Laya-style checkpoint selection by language, task and
input length. Provider limits remain **hard ceilings**; route settings may only
tighten them. Oversized requests must explicitly shortlist, split or escalate,
and every transformation is recorded. It then wires the deferred shortlister and
extends batching.

## 2. Motivation

### 2.1 A byte limit cannot express model constraints

`maxStateBytes` (`validation.ts:88-90`, `runtime.ts:123-125`) is a generic size
cap. It cannot express "roughly N options per Choice under this language and task
budget", nor "this model's confidence is unreliable in this language", nor "this
rubric exceeds the model's supported size". Laya in particular needs checkpoint
selection based on language, task and input length, and its documented
limitations include option-budget pressure and unreliable confidence on
unsuitable languages (claims to verify, §9).

### 2.2 Shortlisting is defined but dead

`DecisionShortlister` (`types.ts:574`) is exported as a future seam and the
runtime explicitly does not call it (`runtime.ts:244-246`). Laya's authors
recommend roughly 20 options per Choice under typical budgets, or an evaluated
shortlist — so without shortlisting, a large candidate set either fails
eligibility or degrades the model.

### 2.3 Batching exists but is un-extended

Decision already sends multiple questions together and expands actions into an
operation head plus target heads (`typed-backend.ts:341-360`) — structurally the
same shape as speculative fan-out. What is missing is batching across independent
states, bounded queue delays, and a policy for choosing between speculative
target questions and a second call after operation selection.

## 3. Goals

1. Preflight the **compiled** request: question count, token budget,
   option-description budget, rubric size, and model/language suitability.
2. Provider limits are hard ceilings; route settings may tighten only.
3. Oversized requests explicitly **shortlist**, **split**, or **escalate**, with
   the transformation recorded (never silently truncated).
4. Invoke `DecisionShortlister` before eligibility; record original + retained
   candidates, shortlister identity, and both digests; label shortlist
   probabilities as conditional.
5. Extend batching: optional cross-state batches, bounded queue delay, and a
   measured speculative-vs-second-call target strategy — all on one consistent
   state snapshot with cancellation and freshness preserved.

## 4. Non-goals

- Output-correctness fixes (RFC-028) and per-question acceptance (RFC-029).
- Changing `authorizeAndReserve` or the edge runtime.
- Implementing a specific tokenizer or checkpoint model in core; these are
  provider-declared capabilities behind a seam.

## 5. Design

### 5.1 Provider preflight descriptors

Extend `DecisionProviderInfo` (`types.ts:448-470`) with declared, testable model
constraints. All fields are optional; absence means "no declared constraint".

```ts
export interface DecisionModelBudget {
  /** Maximum total prompt tokens the model accepts. */
  readonly maxPromptTokens?: number;
  /** Relative cost of a candidate description, in tokens, for budgeting. */
  readonly candidateDescriptionTokens?: number;
  /** Maximum options the model handles reliably before degradation. */
  readonly maxOptionsPerChoice?: number;
  /** Maximum rubric size supported. */
  readonly maxRubricSize?: number;
  /** Languages for which the model's confidence is trustworthy. */
  readonly reliableLanguages?: readonly string[];
}

export interface DecisionProviderInfo {
  // …existing…
  readonly budget?: DecisionModelBudget;
  /** Provider-declared preflight hook, if any (else the runtime estimator is used). */
  readonly preflight?: DecisionPreflight;
}
```

### 5.2 The preflight step

A preflight runs **after request validation and after shortlisting (§5.4), before
eligibility/invocation**, operating on the compiled request:

```ts
export interface PreflightInput {
  readonly request: DecisionProviderRequest;   // post-shortlist
  readonly compiled: CompiledRequestFacts;     // from RFC-028 countCompiledQuestions + more
  readonly model?: DecisionModelRef;
  readonly language?: string;
  readonly task?: 'choice' | 'score' | 'probability' | 'action';
}

export interface CompiledRequestFacts {
  readonly questionCount: number;              // RFC-028 §5.4
  readonly descriptionTokens: number;          // Σ candidate/target description cost
  readonly maxCandidates: number;              // largest Choice criteria set
  readonly maxRubricSize: number;              // largest score rubric
}

export type PreflightVerdict =
  | { readonly kind: 'ok' }
  | { readonly kind: 'tighten'; readonly request: DecisionProviderRequest }
  | { readonly kind: 'shortlist'; readonly required: number }
  | { readonly kind: 'split'; readonly groups: DecisionProviderRequest[] }
  | { readonly kind: 'escalate'; readonly reason: DecisionEscalationReason; readonly message: string };

export interface DecisionPreflight {
  inspect(input: PreflightInput): PreflightVerdict | Promise<PreflightVerdict>;
}
```

Verdict semantics:

- **ok** — proceed.
- **tighten** — apply route-level tightening (e.g. reduce candidates within the
  route's stated budget); the tightened request is what is recorded.
- **shortlist** — the compiled request exceeds an option/rubric budget and must
  be shortlisted; the runtime then invokes the shortlister (§5.4). Shortlisting
  is never skipped to "fit".
- **split** — the batch exceeds a question/token budget and is decomposed into
  groups that each fit; each group is a governed request (RFC-029 assembly can
  recombine).
- **escalate** — no transformation is acceptable (e.g. unreliable language for
  the task); recorded as a skipped attempt with the reason.

### 5.3 Hard ceilings vs route tightening

Preflight **composes** with eligibility rather than replacing it:

- Provider limits (`maxQuestions`, `budget.*`) are **hard ceilings**. A request
  that still exceeds one after permitted transformations is ineligible.
- Route settings (`route.maxQuestions`, `route.budget.*`) may only **tighten** a
  provider ceiling. A route setting that exceeds the provider ceiling is rejected
  at runtime construction (fail closed).
- The recorded limit for a decision is the **minimum** of the two, and which one
  applied is recorded in the attempt.

### 5.4 Shortlisting

Wire the existing interface (`types.ts:574`):

```ts
export interface DecisionShortlister {
  shortlist(params: {
    request: DecisionProviderRequest;
    provider: DecisionProvider;
  }): DecisionProviderRequest | Promise<DecisionProviderRequest>;
}
```

- Invoked **before** eligibility, as the interface already documents.
- The runtime records: original candidate-set digest, effective (retained)
  candidate-set digest, shortlister identity, and the kept candidate IDs. These
  enter the request bindings so the receipt proves what the provider saw.
- **Conditional probabilities:** a distribution over a shortlist is **not** a
  distribution over the full candidate set. The retained answers must be marked
  `distributionScope: 'shortlist'` (with the shortlist digest), and acceptance
  rules that require a complete distribution must treat a shortlist distribution
  as conditional — never relabel it as complete. Marginalisation back to the full
  set is **not** performed silently.
- Shortlister identity and both digests are part of the decision evidence.

### 5.5 Extended batching

```ts
export interface DecisionBatchOptions {
  /** Batch independent states into one provider call when safe. */
  readonly crossState?: boolean;
  /** Bounded delay to accumulate adjacent requests before dispatch (ms). */
  readonly queueDelayMs?: number;
  /**
   * Target strategy: speculative target questions in the same call, or a second
   * call after operation selection. Chosen per route; both measured (§5.5).
   */
  readonly targetStrategy?: 'speculative' | 'second-call';
}
```

Rules:

- **One consistent state snapshot.** All dependent questions in a batch (and any
  RFC-029 follow-up) use the *same* state snapshot and its `stateDigest`. A batch
  that cannot share a snapshot is split, not merged.
- **Cross-state batching is opt-in** and only when the states are independent and
  share a snapshot; otherwise it is refused.
- **Queue delay is bounded** and cancellation-aware: an aborted request never
  waits behind the queue.
- **Freshness is preserved:** the batch carries the snapshot time so RFC-017 /
  application freshness checks remain meaningful.
- **Target strategy is measured.** Speculative target questions cost more tokens
  but save a round trip; the second-call strategy saves tokens but adds latency.
  The profile is selected per deployment after measurement on the target hardware
  — the RFC fixes the *mechanism*, not the choice.

### 5.6 Recording transformations

Every preflight/shortlist/batch transformation is recorded in the attempt and
bindings:

```ts
export interface DecisionTransformation {
  readonly kind: 'tighten' | 'shortlist' | 'split' | 'batch' | 'target-strategy';
  readonly detail?: DecisionValue;
  readonly originalDigest: string;
  readonly effectiveDigest: string;
}
```

The `DecisionAttempt` (or a parallel `transformations[]`) carries these so an
auditor can see that the provider did not see the original candidate set. This is
the same principle as the shortlist record, generalised: **no silent
transformation survives**.

## 6. Compatibility

- All new `DecisionProviderInfo` fields are optional; a provider with no declared
  budget behaves as today (only the existing hard limits apply).
- `DecisionShortlister` becomes live; hosts that never supplied one are
  unaffected (shortlisting only triggers when required by a budget).
- Batching extensions are opt-in per route/runtime.
- A route setting that exceeds a provider ceiling now fails at construction — a
  `0.x` tightening.

## 7. Security considerations

| Case | Behaviour |
|---|---|
| Provider silently truncates candidates to fit | Impossible: oversized requests must shortlist/split/escalate and are recorded. |
| Route raises a limit above the provider ceiling | Rejected at construction; hard ceilings win. |
| Shortlist probability presented as complete | Blocked: `distributionScope: 'shortlist'` + digest; no silent marginalisation. |
| Cross-state batch uses stale/mixed state | Refused: one snapshot, one `stateDigest`, else split. |
| Queue delay blocks cancellation | Bounded and cancellation-aware. |
| Transformation hidden from audit | Every transformation records original + effective digests. |

## 8. Implementation plan

- **P0 — Descriptors + facts.** `DecisionModelBudget`, `CompiledRequestFacts`
  (extending RFC-028's `countCompiledQuestions`).
- **P1 — Preflight.** `DecisionPreflight`, `PreflightVerdict`, hard-ceiling vs
  route-tightening composition; runtime-construction validation.
- **P2 — Shortlisting.** Invoke `DecisionShortlister`; record identity + digests;
  `distributionScope` on affected answers.
- **P3 — Batching.** `DecisionBatchOptions`; single-snapshot rule; bounded queue;
  target strategy seam.
- **P4 — Recording.** `DecisionTransformation[]` in attempt/bindings.
- **P5 — Tests.** (a) over-limit action expansion shortlists/splits rather than
  failing silently; (b) route-limit-above-ceiling rejected; (c) shortlist
  probabilities marked conditional; (d) cross-state batch refused without a
  shared snapshot; (e) transformation digests recorded; (f) token/option budget
  estimated deterministically from fixtures.

## 9. External dependencies to verify and pin

| Claim | Verification task |
|---|---|
| Laya recommends ~20 options per Choice under typical budgets | Confirm the guidance and translate to a declared `maxOptionsPerChoice` |
| Laya needs checkpoint selection by language, task and input length | Confirm the selection dimensions; scope `preflight` |
| Laya's confidence is unreliable in unsuitable languages | Confirm which languages; populate `reliableLanguages` and the escalate path |
| Jev's speculative fan-out matches batch expansion | Confirm; scope `targetStrategy` |
| Laya provides an evaluation harness (accuracy/calibration/latency) | Confirm metrics; reuse in RFC-028 §8 fixtures/evaluation |

## 10. Open questions

- **Q1** Should the runtime ship a default token estimator, or require providers
  to declare `preflight`? (A default risks silent inaccuracy.)
- **Q2** Does `split` belong in the runtime, or should it reuse RFC-029's
  per-question follow-up machinery?
- **Q3** Should `distributionScope: 'shortlist'` live on the answer (digest-bound)
  or only in bindings?
- **Q4** Is cross-state batching safe enough to enable by default for stateless
  providers, or strictly opt-in?

## 11. References

- `docs/rfc/RFC-012-DECISION-RUNTIME.md` — routing, eligibility, deferred shortlisting
- `docs/rfc/RFC-028-DECISION-OUTPUT-CORRECTNESS-NATIVE-BRIDGES.md` — compiled question count
- `docs/rfc/RFC-029-PER-QUESTION-ACCEPTANCE-MULTI-PROVIDER.md` — assembly, follow-up, receipts
- `docs/rfc/RFC-017-DECISION-RECEIPT-GRAPH.md` — evidence linkage and trust boundary
- `packages/decision/src/{runtime,types,validation,typed-backend}.ts`
