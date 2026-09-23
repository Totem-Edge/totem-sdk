# RFC-010: Industrial Action to RC — Industrial Action Definitions on the Governed Edge Runtime

**Status:** Draft — not started
**Created:** 2026-09-23
**Authors:** Totem SDK Contributors
**Reviewers:** [Pending stakeholder assignment]
**Depends on:** RFC-004 (Edge SDK V1 Promotion, §7 Wave 2), RFC-011 (Industrial Action Domain Model & Extensibility — the breadth companion)
**Touches:** `@totemsdk/industrial-action`, `@totemsdk/edge`, `@totemsdk/agent-policy`, `@totemsdk/authority`, `@totemsdk/storage`

---

## 1. Summary

`@totemsdk/industrial-action` is **classified `rc`** in
`scripts/workspace-gates.config.json` (mechanical promotion, commit `1a99861`,
2026-08-28) while `README.md:264` still calls it **Alpha**, and the RFC-004 §7
item for this package — *"Two-phase/idempotent execution, cryptographic
authority proof binding, retry/timeout/rollback"* — is not implemented. The RC
gate set passes only because `lint` and `integration` scripts are absent and are
silently skipped by `scripts/verify-workspace.mjs`.

This RFC makes the RC label true by **composing industrial action with the
already-built governed edge runtime** rather than maintaining a parallel
lifecycle stack. `@totemsdk/edge` already provides the governed execution path
(`AgentEdgeRuntime.executeAction` in `packages/edge/src/agent-runtime.ts`:
ungrantable deny → resolve → capability → **prepare** → **deriveEffects** →
`GrantBoundAutonomyPolicy.authorizeAndReserve` → execute → commit/abort, with
`requires_human` boundary escalation) and the `EdgeActionRegistry`
(`packages/edge/src/action-registry.ts`). `industrial-action` should contribute
**industrial action definitions** to that registry and an **industrial execution
policy** (idempotency, timeout, retry, rollback), plus schema/guardrail
validation and authority-bound receipts — not a second registry, governance
bridge, or receipt model.

The **breadth** work (units, resources/interlocks, composition, vertical
profiles, standards mapping) is deliberately out of scope here and specified in
**RFC-011**.

## 2. Motivation

### 2.1 Classification is ahead of reality

| Source | Says | Reality |
|---|---|---|
| `scripts/workspace-gates.config.json:34` | `maturity: "rc"` | config bump only |
| `README.md:264` | **Alpha** | accurate |
| RFC-004 `:193` | ✅ RC for two-phase/idempotent + authority binding + retry/timeout/rollback | not implemented |

### 2.2 The package duplicates a more mature runtime

`@totemsdk/industrial-action` today maintains its **own** `ActionRegistry`
(`src/registry.ts`), `GovernanceBridge` (`src/governance-bridge.ts`),
`executeAction` (`src/executor.ts`), and `ActionReceipt` (`src/receipt.ts`).
`@totemsdk/edge` already implements the governed equivalent
(`EdgeActionRegistry`, `AgentEdgeRuntime`, `EdgeReceipt`, `GrantBoundAutonomyPolicy`),
including the reserve→execute→commit/abort cycle and human-in-the-loop
escalation. Two divergent stacks is the opposite of generalisable; the RC work
must **converge on the edge runtime**.

### 2.3 Concrete gaps (evidence)

| # | Gap | Evidence |
|---|---|---|
| G0 | Parallel registry/bridge/receipt that duplicate `edge` | `src/{registry,governance-bridge,receipt,executor}.ts` vs `edge/src/{action-registry,agent-runtime,receipts}.ts` |
| G1 | `executeAction` validates params/context against an **empty schema**; both ternary branches identical → no-op | `src/executor.ts:25-26` |
| G2 | `GovernanceBridge.commit`/`abort` are **stubs** returning `{ ok: true }` | `src/governance-bridge.ts:10-15`; asserted by test `industrial-action.test.ts:505` |
| G3 | **No orchestration** tying authority → reserve → execute → commit/abort → storage | no call sites outside `durable-storage.ts` |
| G4 | **No idempotency** — deterministic `executionId` exists but nothing claims/dedups | `src/ids.ts:17`, `src/executor.ts:14-64` |
| G5 | **No timeout/retry/rollback** | `src/executor.ts` single `await` |
| G6 | `mandateProofId` stored but never bound/verified; `checkGovernanceConstraints` reads only `authorityDecision.allowed`/expiry | `src/types.ts:66`, `src/governance-bridge.ts:19-31` |
| G7 | Execution/receipt carry no mandate proof / decision id | `src/types.ts:70-92` |
| G8 | `verifyReceiptIntegrity` only recomputes the id | `src/receipt.ts:30-33` |
| G9 | No `lint`; no `test:integration` (RC gates no-op) | `packages/industrial-action/package.json` |
| G10 | README/config maturity disagreement | `README.md:264` vs config `:34` |
| G11 | No documented breaking-change policy | only `packages/manifest/README.md` has one |

## 3. Relationship to existing architecture

| Concern | Owner | industrial-action's role |
|---|---|---|
| Governed action execution (ungrantable, capability, prepare, effects, reserve, commit/abort, `requires_human`) | `@totemsdk/edge` `AgentEdgeRuntime` + `EdgeActionRegistry` | **Register industrial action definitions**; do not re-implement |
| Mandate/run-budget authorization | `@totemsdk/agent-policy` `GrantBoundAutonomyPolicy` | Supply the canonical action + evidence; bind the resulting mandate proof/decision into the commitment |
| Mandate cryptography | `@totemsdk/authority` `verifyMandate`/`evaluateAuthority` | Consumed via agent-policy; not re-verified |
| Durable records / CAS | `@totemsdk/storage` snapshot | Store device-operation records + idempotency claims |
| Receipts / run receipt graph | `@totemsdk/edge` `EdgeReceipt` (`receipts.ts`) | Emit industrial payloads into the graph |
| Time (expiry, staleness, scheduling) | `docs/temporal-framework-design.md` (§2.4) | Use temporal primitives, not `Date.now()` |
| Device actuation | `@totemsdk/edge-*` adapter ports | Build/prepare device ops, derive effects, execute |

## 4. Scope

- `@totemsdk/industrial-action`: replace the parallel lifecycle with industrial
  `EdgeActionDefinition`s + an industrial execution policy + schema/guardrail
  validation + authority-bound receipt payloads + durable operation records.
- Tests: adversarial, crash/restart under load, emulator E2E.
- CI/metadata: add `lint` + `test:integration`; reconcile README/config.

## 5. Non-goals

- **Domain breadth** (units, resources/interlocks, composition, profiles,
  standards) — see RFC-011.
- Changing `edge`'s runtime semantics or `agent-policy`'s authorization
  algorithm. Only additive hooks if strictly required.
- New transports; the E2E reuses `edge-modbus`/`edge-opcua` emulators.

## 6. Design

### 6.1 Industrial action definitions on the edge registry

Define an `IndustrialActionDefinition` that **produces** an
`EdgeActionDefinition` (`packages/edge/src/action-registry.ts:38`):

```ts
export interface IndustrialActionDefinition<TParams = unknown, TResult = unknown> {
  kind: string;                       // canonical: `industrial:<verb>` (RFC-011 namespaces)
  description: string;
  schema: ActionSchema;               // parameters + context (typed — RFC-011 adds quantities)
  capability: EdgeCapability;         // support check
  effect: EdgeActionEffect;           // 'read' | 'write' | ... (device writes are 'write')
  guardrails?: Condition[];
  /** Industrial execution policy: idempotency, timeout, retry, rollback. */
  policy?: ExecutionPolicy;
  /** Build the real device operation from a validated proposal. */
  prepare(params: TParams, context: Record<string, unknown>): Promise<PreparedDeviceOp>;
  /** Canonical safety facts from the PREPARED op (never from hints). */
  deriveEffects(op: PreparedDeviceOp): StepEffects;
  /** Actuate the device through the edge port. */
  actuate(op: PreparedDeviceOp): Promise<EdgeOperationResult<TResult>>;
}

export function toEdgeActionDefinition(def: IndustrialActionDefinition): EdgeActionDefinition;
```

`toEdgeActionDefinition` maps: `capability`/`effect` pass through; `prepare`
becomes **validate → guardrails → build `PreparedDeviceOp` → bind commitment**;
`deriveEffects` delegates to the industrial definition; `execute` wraps
`actuate` in the industrial execution policy (§6.5) and emits the receipt
(§6.7).

### 6.2 Execution via the governed runtime (two-phase, no re-implementation)

Industrial actions execute through `AgentEdgeRuntime.executeAction`
(`packages/edge/src/agent-runtime.ts:54`), which already performs:

1. ungrantable deny, 2. registry resolve, 3. capability check, 4. prepare,
5. deriveEffects, 6. `policy.authorizeAndReserve` (mandate + run budgets +
nonce), 7. execute, 8. commit/abort — and returns `REQUIRES_HUMAN` on boundary
escalation.

`industrial-action` adds only an **industrial facade** that constructs the
`EdgeActionInput` from an `ActionProposal` and surfaces the policy result. The
old `GovernanceBridge` (`src/governance-bridge.ts`) and `executeAction`
(`src/executor.ts`) are removed from the public surface; the reserve/commit/abort
cycle is owned by `agent-policy`.

### 6.3 Validation and guardrails (fix G1)

`prepare` runs, in order, before any port is touched:

1. `assertValidProposal` (`src/proposal.ts:40`) — commitment integrity.
2. `assertValidParameters(def.schema, …)` + `assertValidContext(def.schema, …, now)`
   (`src/definition.ts:87,94`) — **against the real definition schema** (fixes the
   empty-schema no-op at `executor.ts:25-26`).
3. `evaluateConditions(def.guardrails, …)` (`src/condition.ts:3`).
4. `assertValidProposalTemporal(proposal, now)` — expiry/staleness via the
   temporal framework (§6.8).

A failure throws, and the edge runtime returns `PREPARE_FAILED` **before**
authorization or actuation.

### 6.4 Cryptographic authority-proof binding (fix G6/G7)

The authorization decision is produced by `agent-policy` from the mandate. The
industrial layer **binds** it rather than re-verifying it:

- Extend `computeCommitmentHash` (`src/ids.ts:23`) to include `mandateProofId`
  and `authorityDecision.decisionId` in the domain-separated preimage, so the
  device operation is cryptographically tied to the exact mandate/decision that
  authorized it (intentional pre-RC breaking change; Q1).
- Require that the `effects` the runtime derived equal the effects implied by the
  prepared device op (no authorized-for-X / actuate-Y gap).
- Propagate `mandateProofId` + `decisionId` into the emitted receipt (§6.7).
- Delete `checkGovernanceConstraints`' ad-hoc checks (`src/governance-bridge.ts:19-31`);
  the authority decision is enforced by agent-policy and bound by the commitment.

### 6.5 Industrial execution policy: timeout, retry, rollback (fix G5)

```ts
export interface ExecutionPolicy {
  timeoutMs?: number;                 // default 30_000
  maxAttempts?: number;               // default 1 (opt-in)
  backoffMs?: number;
  retryable?: (e: ActionError) => boolean;  // default: timeout/transport only
  idempotencyKey?: (op: PreparedDeviceOp) => string;  // default: op.operationId
  rollback?: (op: PreparedDeviceOp, outcome: ActionExecution) => Promise<void>;
}
```

- **Timeout**: race `actuate` against `timeoutMs`; a timeout is `unknown`, never
  `confirmed`.
- **Retry**: only when `retryable` returns true **and** the device op is
  idempotent (declared per definition; RFC-011 adds the device error taxonomy).
  Each attempt is recorded; retries must never double-apply a non-idempotent write.
- **Rollback**: on terminal `failed`/`unknown`, run `rollback` (compensating
  action) and record it. Rollback is *not* a safety model — interlocks/safe-state
  are RFC-011.

### 6.6 Idempotency and durable device-operation records (fix G4)

Edge's `stepId`/`nonce` are clock-derived and replay-protect *authorization*;
device actuation needs its own **at-most-once** guarantee. Add a durable
`DeviceOperationRecord` store (over `@totemsdk/storage` snapshot, mirroring
`src/durable-storage.ts` and the CAS patterns in `@totemsdk/statechain`):

```ts
claimOperation(operationId: string, proposalId: string): Promise<EdgeOperationResult<DeviceOperationRecord>>;
transitionOperation(operationId: string, expect: OperationStatus, next: DeviceOperationRecord): Promise<EdgeOperationResult<void>>;
```

`operationId = computeOperationId(commitmentHash, resourceId)` is deterministic,
so a re-submitted or retried action resolves to the same record. If the record is
`confirmed`, return it (dedup); if `in-flight`/`unknown`, apply
`policy.onInFlight`. This makes concurrent double-submits safe under restart.

### 6.7 Receipts as authority-bound evidence (fix G8)

Do **not** add a parallel `ActionReceipt`. Emit an `EdgeReceipt`
(`packages/edge/src/receipts.ts:15`) with an industrial payload:

```ts
createEdgeReceipt({
  kind: 'industrial:action',
  payload: {
    actionId, proposalId, kind, resourceId,
    commitmentHash, mandateProofId, decisionId,
    effects, attempts, status, error?, rollback?,
  },
  issuedAt,
});
```

Add `verifyIndustrialReceipt(receipt)` that (a) calls `verifyEdgeReceipt`
(structural) and (b) recomputes the industrial payload hash over the full body,
and optionally verifies a signature where an operator key is available (Q2).
Receipts feed the run receipt graph (`docs/edge-agent-governance.md:141`).

### 6.8 Temporal integration (fix wall-clock expiry)

Use the temporal framework (`docs/temporal-framework-design.md §2.4`):
proposal expiry → **deadline**, context `maxAgeMs` → **window**, execution
timestamps → **linear**. Until the on-chain temporal primitives land, implement
the same shapes against an injectable clock so tests are deterministic and the
migration is a swap.

### 6.9 Migration

- Remove from the public surface: `ActionRegistry`, `createGovernanceBridge`,
  `executeAction`, `ActionReceipt`, `createReceipt`/`verifyReceiptIntegrity`
  (or re-export as `@deprecated` aliases for one release — Q3).
- Keep the reusable primitives: `createProposal`/`verifyCommitment`,
  `validateParameters`/`validateContext`, `evaluateConditions`,
  `computeCommitmentHash`, and the durable storage layer (repurposed to
  `DeviceOperationRecord`).

## 7. Phases and acceptance gates

| Phase | Work | Gate |
|---|---|---|
| **P0** Truth + gates | README/config reconcile; `lint`; `test:integration` scaffold | `verify-workspace --maturity rc` exercises lint+integration |
| **P1** Converge on edge | `toEdgeActionDefinition`; remove parallel registry/bridge/executor; fix validation no-op (G1/G2/G0) | Unit: definitions register; invalid params rejected pre-authorization |
| **P2** Authority binding | commitment binds `mandateProofId`/`decisionId`; effects-match check (G6/G7) | Unit: tampered mandate/decision breaks commitment; effects mismatch rejected |
| **P3** Idempotency + policy | durable `claimOperation`; timeout/retry/rollback (G4/G5) | Unit: double-submit dedups; timeout→unknown; retry bounded; rollback recorded |
| **P4** Receipts + temporal | `EdgeReceipt` industrial payload; temporal expiry/staleness (G8) | Unit: receipt verifies/tamper-rejected; clock-injected expiry |
| **P5** Adversarial + durability | property/fuzz; crash/restart under load | adversarial suite green; concurrent-load restart green |
| **P6** E2E | `test:integration` via `edge-modbus`/`edge-opcua` emulator | integration suite green in CI |
| **P7** Promotion | README→RC; breaking-change policy; docs/CHANGELOG | `verify-workspace --all` green |

## 8. RC acceptance criteria mapping (RFC-004 §7)

| Criterion | This RFC |
|---|---|
| Two-phase/idempotent execution | §6.2 (edge runtime) + §6.6 (P3) |
| Cryptographic authority proof binding | §6.4 (P2) |
| Retry/timeout/rollback | §6.5 (P3) |
| Real-system E2E | §7 P6 |
| Adversarial property tests | §7 P5 |
| Crash/restart recovery under load | §6.6 + §7 P5 |
| Stable API + breaking-change policy | §6.9 + §7 P7 |
| 100% unit coverage on exports | P1–P4 |
| Zero reachable placeholders | fixes G1/G2 |
| Packed-tarball consumer test | §9 |
| Hostile input/boundary tests | P1/P5 |

## 9. CI and metadata

- `lint`: `"lint": "eslint src --max-warnings 0"` using root `eslint.config.mjs`.
- `test:integration`: emulator E2E (first in repo — see Q5).
- Packed-consumer test: install tarball, register an industrial definition, run a
  governed action against a stub port.
- Docs/CHANGELOG + `SDK_MANIFEST.json` (already listed).

## 10. Security considerations

- **Convergence removes a whole class of drift bugs**: authorization, ungrantable
  deny, and commit/abort are enforced in one place (`edge`/`agent-policy`).
- **Authority binding**: no actuation without an authorized mandate whose proof
  id and decision id are bound into the commitment and receipt.
- **At-most-once actuation** of physical devices via a durable CAS claim.
- **Unknown ≠ success**: timeout/throw never commits; rollback is recorded but is
  not a substitute for interlocks (RFC-011).
- **Retries are opt-in** and require a declared idempotent device op.

## 11. Open questions

- **Q1** Commitment-preimage change (adds `mandateProofId`/`decisionId`): accept
  as pre-RC breaking change, or v2 domain string?
- **Q2** Receipt signing key: operator WOTS via `wots-lease`, grantor key, or both?
- **Q3** Deprecation: keep `ActionRegistry`/`GovernanceBridge` as `@deprecated`
  aliases for one release, or remove outright (0.x)?
- **Q4** `onInFlight` default: `fail`, `return-existing`, or `reconcile`?
- **Q5** Should `verify-workspace` fail an `rc` package that lacks
  `lint`/`test:integration` (affects every current `rc`/`v1` package)?

## 12. References

- `docs/rfc/RFC-011-INDUSTRIAL-ACTION-DOMAIN-MODEL.md` — breadth companion
- `docs/edge-agent-governance.md` — governed runtime, namespaces, receipt graph, boundary escalation
- `docs/temporal-framework-design.md §2.4` — industrial-action temporal mapping
- `packages/edge/src/{action-registry,agent-runtime,receipts,actions}.ts`
- `packages/agent-policy` — `GrantBoundAutonomyPolicy`, `CanonicalAgentAction`
- `packages/authority/src/mandate.ts:93` — `verifyMandate`
- `packages/industrial-action/src/{executor,governance-bridge,receipt,durable-storage,types}.ts`
- `docs/rfc/RFC-004-EDGE-SDK-V1-PROMOTION.md` — Wave 1/2 criteria
