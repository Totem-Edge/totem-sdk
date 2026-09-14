[**@totemsdk/liquidity-bond**](../index.md)

***

[@totemsdk/liquidity-bond](../index.md) / LiquidityProviderBondVerifier

# Interface: LiquidityProviderBondVerifier

Verifier that confirms a provider's bond coin exists and is unspent on-chain.

## Methods

### verifyBond()

> **verifyBond**(`params`): `Promise`\<\{ `reason?`: `string`; `valid`: `boolean`; \}\>

#### Parameters

##### params

###### bondCoinId

`string`

###### ownerProviderId

`string`

#### Returns

`Promise`\<\{ `reason?`: `string`; `valid`: `boolean`; \}\>
