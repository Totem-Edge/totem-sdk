[**@totemsdk/decision**](../index.md)

***

[@totemsdk/decision](../index.md) / createClientDecisionProvider

# Function: createClientDecisionProvider()

> **createClientDecisionProvider**(`options`): [`DecisionProvider`](../interfaces/DecisionProvider.md)

Wrap a provider-specific client as a [DecisionProvider](../interfaces/DecisionProvider.md), translating
only vocabulary. Output stays untrusted and is re-validated by the runtime.

## Parameters

### options

[`ClientDecisionProviderOptions`](../interfaces/ClientDecisionProviderOptions.md)

## Returns

[`DecisionProvider`](../interfaces/DecisionProvider.md)
