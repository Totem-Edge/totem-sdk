# RFC-051 — AI-Proposed Committed Facts: Decision, Inference, Memory and Mandate Seams

Status: Draft for architectural review — proposed, not merged for implementation
Created: 2026-10-18
Authors: Totem SDK Contributors
Depends on: RFC-012 (Decision Runtime), RFC-014 (Wallet/Connect), RFC-017 (Decision Receipt Graph), RFC-019 (Governed Commerce), RFC-021 (Industrial Catalogue Decision Binding), RFC-023 (Physical Effect ), RFC-047 (Experience), RFC-048 (Omnia Primitive Completeness), RFC-049 (MASH × Omnia × Eefi), RFC-050 (Eefi Product Architecture)
Touches (proposed): `decision`, `intelligence`, `qvac`, `authority`, `agent-policy`, `manifest`/`identity`, `proof`/`proofgraph`, `edge`/`industrial-action`; consumed by `omnia*`, Eefi, and Experience

> **Positioning.** RFC-051 is the SDK-wide contract for **how non-deterministic AI output binds
> into deterministic, committed state** — broader than Eefi. It is the "AI proposes" half of
> `AI proposes. Totem authorizes. Experience records.` and a **precondition/dependency of RFC-050**.
>
> **Scope.** Interfaces and invariants only. No implementation is authorised here.

---

## 1. Problem

Every consequential workflow now has a non-deterministic front end:

- **Decision** selects a semantic operation/target from a constrained candidate space.
- **Intelligence/QVAC** produces inferences, embeddings, VLA actions and attestations.
- **Memory** (RFC-047 §30) provides retrieved context.
- **Mandates/agent-policy** bound what an agent may do.

None of these are authority, and none are world truth. Yet their **outputs** must influence
**committed** on-chain state (an Omnia program, an Eefi capital agreement, an industrial action).
Today each package binds this informally. Without a single contract, we get: unbound decisions,
inference treated as truth, metadata masquerading as committed input, and no uniform audit trail.

---

## 2. Principle

| System | Responsibility |
|---|---|
| Decision | select a semantic candidate / answer a bounded question |
| Intelligence / QVAC | compute or infer (non-deterministic) |
| Memory (RFC-047 §30) | retrieve derived context |
| Authority / agent-policy | determine what is permitted and reserve its effects |
| Covenants / MASH | enforce the authorization condition on-chain |
| **This RFC** | the **contract** by which Decision/Inference/Memory become **committed facts** (never authority, never truth) |

---

## 3. The committed-fact rule (normative)

> **CFR-1.** Anything that **influences** a committed outcome MUST be represented in a
> **digest-bound** field of the committing object (the Decision `state` discipline), **never** in
> stripped governance metadata. `DecisionContext` is stripped before provider invocation and MUST
> NOT affect provider output (RFC-012 §11.3); it is therefore **never** authoritative for a
> committed outcome.

> **CFR-2.** A committed fact references its **producer receipt** and its **digest-bound inputs**.
> A signed receipt or a digest proves **integrity and provenance**, not truth or correctness.

> **CFR-3.** No AI artifact grants spend authority. Authorization is **mandate + covenant/MASH**,
> cryptographic and non-discretionary.

**A concrete on-chain carrier for committed facts.** The MSHS-2 **committed-owner-v1** mode
(RFC-049 §5.5) is a ready-made home for digest-bound facts: the locking script commits
`stateroot = SHA3(state)`, `STATE(0)` reveals the preimage, and the successor re-embeds the next root
(1-in/1-out, no recovery branches). A committed fact that must influence a committed outcome can ride
in that state preimage — the `stateroot` *is* the digest binding. (Note: because committed mode
forbids recovery branches, it cannot be combined with P-EXIT covenants, RFC-050 §3.)

---

## 4. Seam A — Decision → committed operation binding

The industrial precedent is the **`semanticDecisionId` ↔ `decisionId`** split (RFC-017/021):
a semantic selection is not an authority decision. Generalise it to any committed operation.

```ts
interface CommittedDecisionBinding {
  version: 'totem:decision-binding/v1';
  scope: 'omnia-operation' | 'eefi-position' | 'industrial-action';
  decisionReceiptId: string;        // DecisionReceipt.receiptId (RFC-017)
  operationId: string;              // Omnia operation / Eefi position / IA operation
  targetId?: string;                // operation-scoped (NOT global)
  candidateSetDigest: string;       // the constrained candidate space
  stateDigest: string;              // digest-bound semantic `state` used for the decision
  decisionId?: string;             // authority decision id — DISTINCT, when present
}
```

**Invariants:** `targetId` stays **scoped** to its operation (RFC-048 §10); `decisionReceiptId`
and `decisionId` remain distinct; the binding is committed into the Omnia output state / Eefi
`stateRulesHash` — **not** stored as metadata. Decision **informs**; it never authorizes.

---

## 5. Seam B — Inference evidence (Intelligence/QVAC)

```ts
interface InferenceEvidenceRef {
  version: 'totem:inference-evidence/v1';
  intelligenceReceiptId: string;    // @totemsdk/intelligence provider receipt
  providerId: string;
  modelId?: string;
  inputRefs: readonly string[];     // bounded multimodal windows (RFC-047 §26.2 / StreamRef + ArtifactStore)
  outputDigest: string;             // commitment to the produced output bytes
  conditionPolicyId?: string;       // if used as a condition witness (RFC-048 OMP-18/19)
}
```

**Invariants:** inference is **evidence**, never the deterministic rule and never ground truth.
A price/risk estimate is an **input** to a committed deterministic rule. Inputs are bounded and
artifact-backed; **an input MUST NOT be implied to have been consumed without evidence**
(RFC-047 §26.2).

---

## 6. Seam C — Memory provenance

Memory revisions (RFC-047 §30) that influence a committed outcome MUST be referenced by **exact
revision** and, when they affect the result, **digest-bound** (not attached as metadata) — the same
rule as CFR-1.

```ts
interface CommittedMemoryRef {
  memoryRef: string;
  revisionRef: string;              // the EXACT revision used
  purpose: 'retrieved-context' | 'risk-input' | 'other';
}
```

**Invariant:** a memory claim is not truth, authority, or proof; a memory ref is evidence about
*state bytes*, not *reasoning*.

---

## 7. Seam D — Mandate / authorization chain

```ts
interface CommittedMandateRef {
  version: 'totem:mandate-ref/v1';
  identityRef: string;              // manifest/identity (who)
  mandateRef: string;               // authority mandate (what is permitted)
  grantRef?: string;                // agent-policy grant (bounded autonomy)
  covenantRef?: string;             // MASH / KISSVM covenant that enforces the condition
}
```

The authorization chain is **identity → authority mandate → agent-policy grant → covenant/MASH**.
The committed object (Omnia program / Eefi capital agreement) carries the `mandateRef`/`grantRef`
so authorization is reproducible and **never discretionary**. Wallet consent (RFC-014 approvals)
is the human/agent-facing end of this chain.

---

## 8. Normative invariants

- **INV-51.1** — A committed outcome references its producer receipt + digest-bound inputs (CFR-2).
- **INV-51.2** — AI artifacts never authorize (CFR-3); authorization is mandate + covenant.
- **INV-51.3** — `DecisionContext` / stripped metadata is never authoritative (CFR-1).
- **INV-51.4** — Scoped ids (`targetId`) are not promoted to global references (RFC-048 §10).
- **INV-51.5** — Inference/memory is evidence, not the deterministic rule, and not ground truth.
- **INV-51.6** — Unknown/unavailable producer receipts are represented honestly (no fabrication).

---

## 9. Non-goals

No model runtime, no memory engine, no second policy engine, no new graph, no new signature
scheme. This RFC only defines **how existing Decision/Intelligence/Memory/Mandate outputs are
committed and referenced**.

---

## 10. Conformance (minimum tests)

1. A decision selection cannot be spent as authority (a spend gated only on a decision receipt fails).
2. Mutating any digest-bound input changes the committed binding id.
3. A `DecisionContext` field cannot influence the committed outcome.
4. A scoped `targetId` cannot be promoted to an unscoped global reference.
5. An inference used as a condition witness must be an independently verifiable evidence ref.
6. A memory ref that influences a quote is digest-bound, not metadata (forensic replay finds the revision).
7. An unknown producer receipt fails closed, not silently accepted.

---

## 11. Open questions

1. Does `CommittedDecisionBinding` live in `decision` (as a new export), in `proof`/`proofgraph`, or split?
2. Do inference evidence refs reuse `proof`/`ProofGraph` evidence nodes verbatim (preferred) or a dedicated type?
3. Mandate binding: reuse `authority` mandate ids directly, or a thin `CommittedMandateRef`?
4. For cross-package Scope unions, is a single registry needed (like the state-port registry)?

---

**Bottom line.** Decision, Inference and Memory **propose**; mandates + covenants **authorize**;
committed state carries only **digest-bound** facts with **producer receipts**. Establish this once,
SDK-wide, so Omnia/Eefi/industrial-action/Experience all bind AI output the same way.
