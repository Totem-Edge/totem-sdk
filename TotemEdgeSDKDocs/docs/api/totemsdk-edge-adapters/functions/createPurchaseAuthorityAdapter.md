[**@totemsdk/edge-adapters**](../index.md)

***

[@totemsdk/edge-adapters](../index.md) / createPurchaseAuthorityAdapter

# Function: createPurchaseAuthorityAdapter()

> **createPurchaseAuthorityAdapter**(`config`): `object`

Create an AuthorityPort adapter over an agent-policy.

approve() builds an AgentProposal from the agreement + intent and evaluates
it through the policy. Returns `{ allowed, reason }`.

## Parameters

### config

[`PurchaseAuthorityAdapterConfig`](../interfaces/PurchaseAuthorityAdapterConfig.md)

## Returns

`object`

### approve()

> **approve**(`params`): `Promise`\<`EdgeOperationResult`\<\{ `allowed`: `boolean`; `reason?`: `string`; \}\>\>

#### Parameters

##### params

###### agreement

`TradeAgreement`

###### intent

`PurchaseIntent`

#### Returns

`Promise`\<`EdgeOperationResult`\<\{ `allowed`: `boolean`; `reason?`: `string`; \}\>\>
