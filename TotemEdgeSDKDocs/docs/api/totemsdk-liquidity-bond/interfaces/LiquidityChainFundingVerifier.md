[**@totemsdk/liquidity-bond**](../index.md)

***

[@totemsdk/liquidity-bond](../index.md) / LiquidityChainFundingVerifier

# Interface: LiquidityChainFundingVerifier

Minimal on-chain funding verifier. Structurally satisfied by
`@totemsdk/chain-provider`'s `DepositVerifier` (extra fields are fine), so a
pool backend can pass the same provider both places without forcing a hard
dependency on chain-provider here.

## Methods

### verifyDeposit()

> **verifyDeposit**(`params`): `Promise`\<\{ `error?`: `unknown`; `reason?`: `string`; `valid`: `boolean`; \}\>

#### Parameters

##### params

###### claimedAmount?

`string`

###### coinId

`string`

###### ownerAddress

`string`

###### tokenId?

`string`

#### Returns

`Promise`\<\{ `error?`: `unknown`; `reason?`: `string`; `valid`: `boolean`; \}\>
