[**@totemsdk/decision**](../index.md)

***

[@totemsdk/decision](../index.md) / DecisionProviderRequest

# Type Alias: DecisionProviderRequest

> **DecisionProviderRequest** = \{ `kind`: `"questions"`; `questions`: readonly [`DecisionQuestion`](DecisionQuestion.md)[]; `requestId`: `string`; `signal?`: `AbortSignal`; `state`: [`DecisionValue`](DecisionValue.md); \} \| \{ `goal?`: `string`; `kind`: `"action"`; `operations`: readonly [`DecisionOperation`](../interfaces/DecisionOperation.md)[]; `requestId`: `string`; `signal?`: `AbortSignal`; `state`: [`DecisionValue`](DecisionValue.md); \}

Provider-facing request. Semantically complete, trace-free: no `context`,
no caller-owned tracing fields. `requestId` is runtime-issued so provider
cancels are always addressable.
