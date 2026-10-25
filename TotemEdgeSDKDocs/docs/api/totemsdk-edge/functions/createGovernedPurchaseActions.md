[**@totemsdk/edge**](../index.md)

***

[@totemsdk/edge](../index.md) / createGovernedPurchaseActions

# Function: createGovernedPurchaseActions()

> **createGovernedPurchaseActions**(`config`): [`BuiltinActionRegistration`](../interfaces/BuiltinActionRegistration.md)[]

Build the governed commerce action definitions.

Register these into the same `EdgeActionRegistry` used by
`createAgentEdgeRuntime()`; the agent can then reach commerce only via
`executeAction('purchase:buy' | 'purchase:negotiate')`.

## Parameters

### config

[`GovernedCommerceConfig`](../interfaces/GovernedCommerceConfig.md)

## Returns

[`BuiltinActionRegistration`](../interfaces/BuiltinActionRegistration.md)[]
