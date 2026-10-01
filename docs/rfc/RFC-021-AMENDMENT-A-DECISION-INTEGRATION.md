# RFC-021 Amendment A — Industrial Catalogue Interaction with Model-Aware Decision

**Status:** Draft · **Date:** 2026-10-01 · **Amends:** RFC-021
**Touches:** `@totemsdk/industrial-action` (decision subpath), `@totemsdk/decision`
**Depends on:** RFC-021 (Catalogue & Decision Binding), RFC-028 (Output Correctness & Native Bridges), RFC-029 (Per-Question Acceptance & Multi-Provider Assembly), RFC-030 (Model-Aware Preflight, Shortlisting & Batching)

> Focused amendment, not a rewrite. RFC-021 defines how registered industrial
> definitions compile to Decision candidates. RFC-028–030 change what the
> Decision runtime does with those candidates (stricter validation, per-question
> acceptance and assembly, preflight/shortlisting/batching). This amendment
> reconciles the two so the catalogue remains truthful under the new behaviour.

---

## A.1 Summary

RFC-028–030 make three things true that RFC-021 assumed away:

1. The provider sees the **compiled** request, whose question count exceeds the
   logical candidate count (action expansion, RFC-028 §5.4).
2. A request may be **shortlisted** or **split** before invocation, so the
   provider may not see every registered candidate/target (RFC-030 §5.4–5.5).
3. Acceptance may be **per question and assembled across providers**
   (RFC-029), so a single `DecisionRef` may no longer correspond to a single
   provider invocation.

RFC-021's binding was written as if the provider always saw the full candidate
set from one provider. Under RFC-030 it may not. This amendment records the
shortlist/split in candidate metadata and in the handoff, so a `DecisionRef`
still resolves to exactly one registered definition and resource even when the
selection was made from a reduced, conditional candidate set.

## A.2 What changes in Decision

| RFC-021 assumption | New reality (RFC-028–030) | Amendment action |
|---|---|---|
| Candidate count = `operations/targets` count | Compiled count includes the action head and target heads (RFC-028 §5.4) | Compile candidates with a declared compiled-question cost so preflight can budget |
| Provider sees all candidates | Shortlisting/splitting may reduce or partition the set (RFC-030) | Record original + effective candidate-set digests in candidate metadata |
| One provider answers a request | Assembly may draw answers from several providers (RFC-029) | Handoff `DecisionRef` records per-answer provider/bindings |
| Target head probabilities are complete | A shortlist distribution is conditional (RFC-030 §5.4) | Mark target-head distributions `distributionScope` |

## A.3 Candidates carry compiled-question budget facts

`CatalogueCandidate` (RFC-021 §5.2) gains a declared cost so RFC-030 preflight
can budget without re-parsing the definition:

```ts
export interface CatalogueCandidate {
  // …RFC-021 fields…
  readonly compiledCost: {
    /** 1 for the operation head; +1 when this operation has targets. */
    readonly questions: number;
    /** Σ candidate/target description token estimate, for provider budgeting. */
    readonly descriptionTokens: number;
    /** Largest choice set this candidate presents. */
    readonly maxCandidates: number;
  };
}
```

`buildDecisionOperationCandidates` (RFC-021 §5.3) computes this from the
registered definition and its resolved targets. It is **deterministic** and
participates in the catalogue digest, so a cost change is detectable.

## A.4 Shortlist/split are recorded in candidate metadata

When RFC-030's preflight shortlists or splits a catalogue-derived request, the
candidate metadata must carry the transformation so a later `resolveDecisionSelection`
(RFC-021 §5.4) can still fail closed correctly:

```ts
export interface CatalogueTransformRecord {
  readonly kind: 'shortlist' | 'split';
  /** Digest over the full registered candidate/target set for this operation. */
  readonly originalDigest: string;
  /** Digest over the candidates/targets actually presented to the provider. */
  readonly effectiveDigest: string;
  readonly shortlisterId?: string;
}
```

- A selected target that was **not** presented to the provider cannot be
  resolved: `resolveDecisionSelection` rejects it (`INVALID_CANDIDATE`), because
  the candidate was never offered.
- A selected target that was presented resolves normally, but the
  `CatalogueTransformRecord` is carried into the handoff so the receipt shows the
  selection was made from a reduced set.
- RFC-030's `DecisionTransformation` (RFC-030 §5.6) is the Decision-side record;
  `CatalogueTransformRecord` is its industrial projection, keyed by
  `operationId`.

## A.5 Parameter alternatives become bounded, referenced payload digests

RFC-021 §5.5 already gives each `ParameterAlternative` a `payloadDigest`. Under
RFC-028/029 these become the stable references that:

- RFC-028's validation can bind against the prepared command (via RFC-022's
  `preparedCommandHash`), and
- RFC-029's assembled, per-question answers can cite when a parameter question
  is resolved separately from the operation question.

No shape change is required; the amendment records that the digest is the
**join key** between a Decision parameter selection and the industrial
commitment, and that it must use the distinct parameters domain (RFC-021 Q2)
rather than the commitment domain.

## A.6 Handoff `DecisionRef` records per-answer provenance

RFC-017's `DecisionRef` (implemented, `packages/decision/src/decision-ref.ts`)
carries a single `providerId`. When RFC-029 assembles answers from more than one
provider, that single field is insufficient. The handoff must not lose which
provider answered which question:

```ts
// Extension to the ref used at the industrial handoff (additive, inert).
export interface DecisionRefAssembly {
  readonly providerIds: readonly string[];
  readonly contributions: readonly {
    readonly questionId: string;
    readonly providerId: string;
  }[];
}
```

`DecisionRef`/`DecisionRefRecord` may gain an optional `assembly` field (or the
assembly receipt id, RFC-029 §5.5, may be referenced instead). Either way the
industrial receipt records the linkage; authority remains unaffected because a
`DecisionRef` still grants nothing (RFC-017 §5.6).

## A.7 Conditional target-head distributions

RFC-021 compiles each target-bearing operation into its own Decision target head
(RFC-030 §5.5, `typed-backend.ts:341-360`). If a target head was shortlisted, its
distribution is conditional on that shortlist. The catalogue must therefore:

- mark the affected target heads `distributionScope: 'shortlist'` with the
  shortlist digest (RFC-030 §5.4), and
- ensure an acceptance rule requiring a **complete** target distribution does not
  silently accept a conditional one.

This preserves RFC-021's central guarantee — a target resolves to exactly one
registered resource — without overstating the probability evidence.

## A.8 Implementation plan

- **A0 — Cost.** `compiledCost` on `CatalogueCandidate`; deterministic computation
  in `buildDecisionOperationCandidates`.
- **A1 — Transform record.** `CatalogueTransformRecord`; projected from RFC-030's
  `DecisionTransformation`.
- **A2 — Resolver.** `resolveDecisionSelection` rejects targets absent from the
  effective (post-shortlist) set; carries the transform record into the handoff.
- **A3 — Ref assembly.** Optional per-answer provider provenance on the handoff
  `DecisionRef`; industrial receipt records it.
- **A4 — Conditional heads.** `distributionScope` propagation to catalogue target
  heads.
- **A5 — Tests.** (a) shortlisted target can still resolve and records the
  transform; (b) a target absent from the effective set is rejected; (c) parameter
  digest joins selection ↔ commitment; (d) multi-provider assembly preserves
  per-question provenance; (e) conditional target distribution never accepted as
  complete.

## A.9 Open questions

- **Q1** Should `compiledCost` live on the candidate (proposed) or be recomputed
  by RFC-030's preflight from the definition directly?
- **Q2** Is `CatalogueTransformRecord` redundant with RFC-030's
  `DecisionTransformation`, or does the industrial projection earn its keep?
- **Q3** Should the handoff carry the full `DecisionRefAssembly` or only the
  RFC-029 assembly receipt id?

## A.10 References

- `docs/rfc/RFC-021-INDUSTRIAL-CATALOGUE-DECISION-BINDING.md` — base RFC
- `docs/rfc/RFC-022-PREPARED-COMMAND-BINDING-ASYNC-LIFECYCLE.md` — `preparedCommandHash` join
- `docs/rfc/RFC-028-DECISION-OUTPUT-CORRECTNESS-NATIVE-BRIDGES.md` — compiled question count
- `docs/rfc/RFC-029-PER-QUESTION-ACCEPTANCE-MULTI-PROVIDER.md` — assembly, receipts
- `docs/rfc/RFC-030-MODEL-AWARE-PREFLIGHT-SHORTLISTING-BATCHING.md` — shortlist/split, transformations
- `packages/decision/src/decision-ref.ts`, `packages/industrial-action/src/profiles.ts`
