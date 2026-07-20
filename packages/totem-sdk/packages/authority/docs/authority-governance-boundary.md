# Authority–Governance Boundary

## Design Constraint

The `@totemsdk/authority` package is a **deterministic authority engine**, not a governance or policy system. It answers one question:

> *Given a set of identity graphs, a mandate, and a usage snapshot, does the proposed action have verifiable authority?*

It does **not** answer:

- Should this mandate have been issued?
- Is this policy compliant with organizational rules?
- What is the correct `usageLimit` for a given context?

## Responsibilities

### `@totemsdk/authority` (v0.1)

- Verify cryptographic integrity of mandate proofs
- Check scope matching (`matchScope`, `matchConstraints`)
- Enforce usage limits (`checkUsageLimit`)
- Detect identity revocation (via `resolveIdentityGraph`)
- Detect mandate revocation (via `MandateStatusSnapshot`)
- Return deterministic `AuthorityDecision` with `decisionId`
- Provide pure functions: `evaluateAuthority` does not mutate state

### Future `@totemsdk/governance` (not yet implemented)

- Mandate issuance workflows (multi-sig, quorum, approval chains)
- Policy-as-code evaluation (OPA, Cedar, custom DSL)
- Historical authority queries ("was X authorized at time T?")
- Rate-limit window management (rolling vs fixed)
- Usage store implementations (in-memory, SQLite, Redis)
- Mandate lifecycle (issuance, renewal, revocation workflows)
- Audit log generation

## Integration Pattern

```typescript
// governance (future) owns: identity resolution, usage store, mandate lifecycle
// authority (v0.1) owns: deterministic evaluation

import { evaluateAuthority } from '@totemsdk/authority';

// governance provides these:
const identityResolver = governance.createResolver();
const usageSnapshot = await usageStore.getSnapshot(mandateProofId);
const mandateStatus = await mandateStore.getStatus(mandateId);

// authority evaluates:
const { decision, usageDelta } = evaluateAuthority({
  action,
  mandate,
  identityResolver,
  usageSnapshot,
  mandateStatus,
  now: Date.now(),
});

// governance applies usage:
if (decision.allowed) {
  await usageStore.record(mandateProofId, usageDelta);
}
```

## Why Separate?

1. **Testability** — `evaluateAuthority` is pure; all side effects live in governance
2. **Determinism** — same inputs → same `decisionId`; critical for audit
3. **Composability** — governance can wrap authority with policies without modifying authority logic
4. **Security boundary** — the pure core is easier to audit than a combined system
