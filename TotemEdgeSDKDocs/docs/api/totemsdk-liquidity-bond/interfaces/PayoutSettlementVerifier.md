[**@totemsdk/liquidity-bond**](../index.md)

***

[@totemsdk/liquidity-bond](../index.md) / PayoutSettlementVerifier

# Interface: PayoutSettlementVerifier

Verifier that confirms a payout actually settled. Implementations read a
real evidence source — an on-chain transaction at the required depth, or a
signed channel/factory settlement — and must bind the result to the exact
payout identity they are given.

## Methods

### verifySettlement()

> **verifySettlement**(`params`): `Promise`\<\{ `reason?`: `string`; `valid`: `boolean`; \}\>

#### Parameters

##### params

###### amount

`bigint`

###### poolId

`string`

###### positionId

`string`

###### recipientAddress

`string`

###### settlement

[`PayoutSettlementEvidence`](PayoutSettlementEvidence.md)

###### withdrawalId?

`string`

Present for withdrawal payouts.

#### Returns

`Promise`\<\{ `reason?`: `string`; `valid`: `boolean`; \}\>
