[**@totemsdk/decision**](../index.md)

***

[@totemsdk/decision](../index.md) / assertDecisionFresh

# Function: assertDecisionFresh()

> **assertDecisionFresh**(`result`, `currentRequest`): `void`

## Parameters

### result

#### bindings?

\{ `requestDigest`: `string`; \}

#### bindings.requestDigest

`string`

### currentRequest

[`DecisionRequest`](../type-aliases/DecisionRequest.md)

## Returns

`void`

## Throws

`STALE_DECISION` when not fresh.
