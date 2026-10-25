[**@totemsdk/recursive-mast**](../index.md)

***

[@totemsdk/recursive-mast](../index.md) / evaluateAvailabilityGate

# Function: evaluateAvailabilityGate()

> **evaluateAvailabilityGate**(`config`): `Promise`\<[`AvailabilityGateDecision`](../interfaces/AvailabilityGateDecision.md)\>

Evaluate whether an operation may proceed under policy availability.

- `kind: 'content'` is fail-closed: denied when the action's branch is
  missing from every replica, or the manifest is below the minimum replica
  count.
- `kind: 'recovery'` is never gated by content availability and always
  proceeds; the recovery material's own availability is reported separately.

## Parameters

### config

[`AvailabilityGateConfig`](../interfaces/AvailabilityGateConfig.md)

## Returns

`Promise`\<[`AvailabilityGateDecision`](../interfaces/AvailabilityGateDecision.md)\>
