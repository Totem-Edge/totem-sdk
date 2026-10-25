[**@totemsdk/decision**](../index.md)

***

[@totemsdk/decision](../index.md) / DecisionProviderOutcome

# Type Alias: DecisionProviderOutcome\<T\>

> **DecisionProviderOutcome**\<`T`\> = \[`T`\] *extends* \[`void`\] ? \{ `ok`: `true`; `requestId`: `string`; \} \| [`DecisionProviderFailure`](../interfaces/DecisionProviderFailure.md) : [`DecisionProviderSuccess`](../interfaces/DecisionProviderSuccess.md)\<`T`\> \| [`DecisionProviderFailure`](../interfaces/DecisionProviderFailure.md)

Provider outcome. `DecisionProviderOutcome<void>` is the control form used by
`cancel` (no proposed decision).

## Type Parameters

### T

`T` = [`DecisionResult`](DecisionResult.md)
