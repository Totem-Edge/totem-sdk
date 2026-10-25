[**@totemsdk/decision**](../index.md)

***

[@totemsdk/decision](../index.md) / validateProviderDecision

# Function: validateProviderDecision()

> **validateProviderDecision**(`providerRequest`, `decision`, `options?`): [`DecisionResult`](../type-aliases/DecisionResult.md)

Validate and normalize a provider-proposed decision against the offered
candidate space. Returns a clean canonical [DecisionResult](../type-aliases/DecisionResult.md); unknown
fields are dropped. Providers cannot invent IDs or malformed distributions.

## Parameters

### providerRequest

[`DecisionProviderRequest`](../type-aliases/DecisionProviderRequest.md)

### decision

`unknown`

### options?

[`ProviderDecisionValidationOptions`](../interfaces/ProviderDecisionValidationOptions.md) = `{}`

## Returns

[`DecisionResult`](../type-aliases/DecisionResult.md)

## Throws

`INVALID_OUTPUT` | `INVALID_CANDIDATE` | `INVALID_DISTRIBUTION`
