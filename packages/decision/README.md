# @totemsdk/decision

Provider-neutral **decision runtime** — typed, constrained, provenance-bound
proposals over dynamic candidate spaces.

Decision is the **bounded semantic choice** layer of Totem. It sits between
inference and authority:

```text
@totemsdk/intelligence  → primitive inference / model execution ("what does the data mean?")
@totemsdk/decision      → bounded semantic choice ("what should be proposed?")
@totemsdk/agent-policy  → policy / governance
@totemsdk/authority     → permission
@totemsdk/industrial-action / edge-* → execution
```

**AI proposes, Totem authorizes.** A decision provider is a compute surface: it
cannot sign, move value, or hold keys. It returns a proposal; the trusted
runtime validates it and issues an advisory receipt.

## Trust boundary

```text
DecisionProviderOutcome        (provider, untrusted — proposal only)
        ↓ runtime validates candidate membership + distributions
        ↓ acceptance / escalation
DecisionOutcome                (runtime, trusted)
        + bindings + receipt + attempts
```

Providers can never supply `stateDigest`, `requestDigest`, `outputDigest`,
`attempts`, or a `DecisionReceipt`.

## Quick start

```ts
import {
  createDecisionRuntime,
  createEdgeDecisionPort,
  type DecisionProvider,
} from '@totemsdk/decision';

declare const provider: DecisionProvider; // Laya, Jev, Intelligence, …

const runtime = createDecisionRuntime({
  routes: [
    { provider, types: ['choice', 'score', 'probability', 'action'], accept: { minConfidence: 0.75 } },
    { provider: fallback }, // escalate on low confidence / invalid output
  ],
});

const outcome = await runtime.decide({
  kind: 'questions',
  state: { temperature: 21, occupancy: 0.4 },
  questions: [
    { type: 'choice', id: 'hvac', criteria: [{ id: 'heat' }, { id: 'cool' }, { id: 'hold' }] },
    { type: 'probability', id: 'rain', proposition: 'it will rain within the hour' },
  ],
});

if (outcome.ok) {
  console.log(outcome.decision, outcome.receipt.receiptId, outcome.bindings.requestDigest);
}
```

## Semantics

Four canonical decision types: `choice`, `score`, `probability`, `action`.

- **choice** — select exactly one candidate, optional distribution.
- **score** — ordered rubric (increasing); `expectedScore` is the zero-based
  expectation over rubric order.
- **probability** — `probabilityTrue` for a proposition.
- **action** — select an `operation` and (when offered) a compatible `target`.
  Operation and target heads are never flattened.

Candidate ordering is semantic and digest-bound: the runtime never sorts.

## Adapters (injected seams — zero model dependencies in this package)

```ts
import { createLayaDecisionProvider } from '@totemsdk/decision/laya';
import { createJevDecisionProvider } from '@totemsdk/decision/jev';
import { createIntelligenceDecisionProvider } from '@totemsdk/decision/intelligence';
```

- `laya` translates Totem `probability ↔ noul`; `noul` never escapes.
- `jev` wraps a Jev client; no browser imports, credentials are explicit.
- `intelligence` consumes an `IntelligenceProvider` as a generative fallback.

## Edge hosting

```ts
import { createEdgeDecisionPort } from '@totemsdk/decision';
const port = createEdgeDecisionPort(runtime);
// @totemsdk/edge re-exports EdgeDecisionPort and dispatches
// decision:decide / decision:cancel via EdgeRuntimePorts.decision.
```

Decision is a sibling of intelligence, not an intelligence domain — never
`intelligence:decision`. `decision:decide` is capability-gated on the union of
the request's decision types; `decision:cancel` is control-plane and ungated.

## Determinism, digests, freshness

- Domain-separated SHA3 digests: state, candidates, request, output, receipt.
- `context` is trace/governance metadata and never affects provider semantics or
  the request digest.
- `isDecisionFresh(result, currentRequest)` compares `requestDigest` equality;
  changing state, candidates, goal, or instructions invalidates a result.

## Testing

`@totemsdk/decision/testing` ships structural mocks. The suite is offline — no
network, models, or credentials.
