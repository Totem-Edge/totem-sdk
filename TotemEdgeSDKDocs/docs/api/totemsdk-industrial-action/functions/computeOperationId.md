[**@totemsdk/industrial-action**](../index.md)

***

[@totemsdk/industrial-action](../index.md) / computeOperationId

# Function: computeOperationId()

> **computeOperationId**(`commitmentHash`, `resourceId?`): `string`

Deterministic device-operation id (RFC-010 §6.6).

Derived from the proposal commitment and the target resource, so a
re-submitted or retried action resolves to the same operation and can be
deduplicated by a durable claim.

## Parameters

### commitmentHash

`string`

### resourceId?

`string`

## Returns

`string`
