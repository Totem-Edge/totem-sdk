[**@totemsdk/decision**](../index.md)

***

[@totemsdk/decision](../index.md) / isDecisionFresh

# Function: isDecisionFresh()

> **isDecisionFresh**(`result`, `currentRequest`): `boolean`

A result is fresh when its `requestDigest` equals the digest of the current
request. Because `requestDigest` incorporates state and candidate digests, it
also invalidates on state, candidate-set, goal, or instruction changes
(RFC-012 §30).

## Parameters

### result

#### bindings?

\{ `requestDigest`: `string`; \}

#### bindings.requestDigest

`string`

### currentRequest

[`DecisionRequest`](../type-aliases/DecisionRequest.md)

## Returns

`boolean`
