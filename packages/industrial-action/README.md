# @totemsdk/industrial-action

Deterministic industrial action lifecycle for Totem Edge — converts governed intent into context-aware, bounded, verifiably executed operations on field devices and protocols.

## Install

```bash
npm install @totemsdk/industrial-action
```

## Design

This package sits between governance/authority (intent + mandate) and edge protocol transports (OPC-UA, Modbus, BACnet, etc.). It provides:

- **Action definition & schema** — declare parameter and context schemas per action kind
- **Proposal lifecycle** — propose, validate commitment, check expiry, verify executability
- **Commitment hashing** — domain-prefixed SHA3-256 canonical binding prevents parameter tampering
- **Guardrails / conditions** — evaluate pre-execution constraints (parameter range, context match, time window, custom)
- **Executor abstraction** — plugin executors per action kind, confirmed/failed/unknown status mapping
- **Governance bridge** — reserve-before-execute, commit-on-confirmed, abort-on-failure flow
- **Action receipts** — verifiable proof records with integrity checks
- **Registry** — register definitions and executors, lookup by kind

## Quick start

```ts
import { createProposal, createActionDefinition, executeAction, ActionRegistry, evaluateConditions } from '@totemsdk/industrial-action';
import type { ActionSchema, Condition } from '@totemsdk/industrial-action';

// 1. Define schema
const setTempSchema: ActionSchema = {
  parameters: [
    { name: 'setpoint', type: 'number', required: true },
    { name: 'rampRate', type: 'number', required: false },
  ],
  context: [
    { name: 'zoneId', type: 'string', required: true },
  ],
};

// 2. Create definition
const setTempDef = createActionDefinition('temp.set', 'Set temperature setpoint', setTempSchema, {
  async execute(params, context) {
    // send to PLC / BACnet / OPC-UA
    return { ok: true, data: { applied: true } };
  },
});

// 3. Register
const registry = new ActionRegistry();
registry.registerDefinition(setTempDef);

// 4. Create proposal
const proposal = createProposal({
  kind: 'temp.set',
  parameters: { setpoint: 22.5, rampRate: 1.0 },
  context: { zoneId: 'HVAC-03' },
});

// 5. Check conditions
const guards: Condition[] = [
  { type: 'parameter_range', field: 'setpoint', operator: 'gte', value: 10 },
  { type: 'parameter_range', field: 'setpoint', operator: 'lte', value: 35 },
];
const { passed, failed } = evaluateConditions(guards, proposal.parameters, proposal.context);

// 6. Execute
if (passed) {
  const { execution, receipt } = await executeAction(proposal, { kind: 'temp.set', execute: setTempDef.handler.execute }, proposal.context);
  console.log(execution.status); // 'confirmed' | 'failed' | 'unknown'
}
```

## API

### Core types
- `ActionProposal` — proposed action with commitment hash (bound to the mandate proof), expiry, optional authority decision
- `IndustrialActionDefinition` — edge-facing definition compiled via `toEdgeActionDefinition`
- `PreparedDeviceOp` — commitment-bound device operation (commitment, operationId, resource)
- `ExecutionPolicy` — failure mode, timeout, retry, rollback, in-flight behaviour
- `FailureMode` / `ActionOutcome` — declared failure semantics and terminal outcomes
- `DeviceOperationRecord` — durable at-most-once operation record
- `ActionSchema` — parameter and context field schemas
- `Condition` — guardrail with field, operator, value, custom evaluator

### Key functions
| Function | Purpose |
|----------|---------|
| `createProposal` / `verifyCommitment` | Create and verify a proposal and its commitment |
| `validateParameters` / `validateContext` | Validate inputs against a schema |
| `evaluateConditions` | Evaluate guardrails before execution |
| `toEdgeActionDefinition` | Compile an industrial definition into an edge action |
| `runWithPolicy` | Run actuation under the execution policy + failure semantics |
| `createDurableDeviceOperationStore` | Durable at-most-once operation store |
| `createIndustrialReceipt` / `verifyIndustrialReceipt` | Emit and verify authority-bound `EdgeReceipt`s |
| `computeCommitmentHash` / `computeOperationId` / `computeAuthorityBindingHash` | Deterministic, authority-bound identifiers |

### Errors
- `IndustrialActionError` (base)
- `ActionValidationError` — parameter/context validation failures
- `ActionCommitmentError` — commitment hash mismatch
- `ActionConditionError` — guardrail violations
- `ActionDefinitionError` — definition/registration issues

## Governed execution (RFC-010)

Industrial actions run on the `@totemsdk/edge` governed runtime
(`AgentEdgeRuntime` + `EdgeActionRegistry`), not a parallel lifecycle:

- `IndustrialActionDefinition` → `toEdgeActionDefinition` compiles an industrial
  action into an edge `EdgeActionDefinition`.
- `prepare` validates against the schema, evaluates guardrails, binds the
  authorizing `mandateProofId` into the commitment, and derives a deterministic
  `operationId`.
- `ExecutionPolicy.failureMode` (`fail-safe` / `fail-silent` / `fail-closed` /
  `fail-operational` / `abort`) is **mandatory for `write` actions**; outcomes are
  `confirmed | failed | unknown | aborted | safe-stated | suppressed |
  requires-reset` — never a bare boolean.
- `createDurableDeviceOperationStore` gives actuation an at-most-once guarantee.
- `createIndustrialReceipt` / `verifyIndustrialReceipt` emit authority-bound
  `EdgeReceipt`s.

The legacy `ActionRegistry`, `createGovernanceBridge`, `executeAction`, and
`ActionReceipt` are **deprecated** and will be removed; use the edge-runtime path.

## Breaking change policy

- The package follows semantic versioning; while `0.x`, minor versions may
  contain breaking changes, which are called out in the changelog and marked
  with `@deprecated` for at least one minor release before removal.
- Deprecated symbols remain functional for one minor release, then are removed
  in the next minor (pre-1.0) or major (post-1.0) release.
- Public API is the package root export (`@totemsdk/industrial-action`); subpath
  imports and `src/*` are not public.

## Dependencies

- `@totemsdk/core` — SHA3-256 hashing
- `@totemsdk/proof` — proof types
- `@totemsdk/authority` — mandate types
- `@totemsdk/edge` — governed runtime, `EdgeActionDefinition`, `EdgeReceipt`
- `@totemsdk/agent-policy` — `StepEffects`

## License

MIT
