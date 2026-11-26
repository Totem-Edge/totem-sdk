[**@totemsdk/omnia**](../index.md)

***

[@totemsdk/omnia](../index.md) / FundingWitnessBuilder

# Interface: FundingWitnessBuilder

Wallet-side port that assembles the signed funding witness for a channel open.

The dApp supplies the funding coin id and channel terms. The wallet owns the
coin, so only the wallet can build the funding witness. A dApp or provider
MUST NOT be able to substitute a witness for a different coin or amount.

## Methods

### build()

> **build**(`input`): `Promise`\<\{ `fundingWitnessBytes`: `Uint8Array`; \}\>

#### Parameters

##### input

[`FundingWitnessBuilderInput`](FundingWitnessBuilderInput.md)

#### Returns

`Promise`\<\{ `fundingWitnessBytes`: `Uint8Array`; \}\>
