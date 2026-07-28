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
- `ActionProposal` — proposed action with commitment hash, expiry, optional authority decision
- `ActionExecution` — execution record with status, result, error, receipt
- `ActionReceipt` — verifiable proof of action outcome
- `IndustrialActionDefinition` — action kind + schema + handler
- `ActionSchema` — parameter and context field schemas
- `Condition` — guardrail with field, operator, value, custom evaluator

### Key functions
| Function | Purpose |
|----------|---------|
| `createProposal` | Create action proposal with computed ID and commitment hash |
| `verifyCommitment` | Check proposal integrity against tampering |
| `createActionDefinition` | Define an action kind with schema |
| `validateParameters` / `validateContext` | Validate inputs against schema |
| `evaluateConditions` | Evaluate guardrails before execution |
| `executeAction` | Run executor, map result to confirmed/failed/unknown |
| `createReceipt` / `verifyReceiptIntegrity` | Create and verify action receipts |
| `createGovernanceBridge` | Wrap reserve/commit/abort for governance integration |

### Errors
- `IndustrialActionError` (base)
- `ActionValidationError` — parameter/context validation failures
- `ActionCommitmentError` — commitment hash mismatch
- `ActionConditionError` — guardrail violations
- `ActionExecutionError` — executor failures
- `ActionGovernanceError` — governance bridge failures
- `ActionDefinitionError` — registry/definition issues

## Dependencies

- `@totemsdk/core` — SHA3-256 hashing
- `@totemsdk/proof` — proof types
- `@totemsdk/authority` — mandate types
- `@totemsdk/edge` — `EdgeOperationResult`

## License

MIT
