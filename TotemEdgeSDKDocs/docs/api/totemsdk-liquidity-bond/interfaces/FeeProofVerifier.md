[**@totemsdk/liquidity-bond**](../index.md)

***

[@totemsdk/liquidity-bond](../index.md) / FeeProofVerifier

# Interface: FeeProofVerifier

Verifier for a fee's earn-proof. "Verified" means a checked payment proof.

## Methods

### verifyFeeProof()

> **verifyFeeProof**(`params`): `Promise`\<\{ `reason?`: `string`; `valid`: `boolean`; \}\>

#### Parameters

##### params

###### grossAmount

`bigint`

###### poolId

`string`

###### positionId

`string`

###### proof

`unknown`

###### source

[`EarnableFeeSource`](../type-aliases/EarnableFeeSource.md)

#### Returns

`Promise`\<\{ `reason?`: `string`; `valid`: `boolean`; \}\>
