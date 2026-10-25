[**@totemsdk/omnia-splice**](../index.md)

***

[@totemsdk/omnia-splice](../index.md) / buildSpliceInProposal

# Function: buildSpliceInProposal()

> **buildSpliceInProposal**(`channel`, `additionalCoinId`, `additionalAmount`, `proposerPublicKeyDigest`, `newBalances?`): [`UnsignedSpliceProposal`](../interfaces/UnsignedSpliceProposal.md)

Build an unsigned splice-in proposal (see `buildSpliceProposal`).

## Parameters

### channel

`OmniaChannel` \| [`QuiescedChannel`](../type-aliases/QuiescedChannel.md)

### additionalCoinId

`string`

### additionalAmount

`bigint`

### proposerPublicKeyDigest

`string`

### newBalances?

`Record`\<`string`, `bigint`\>

## Returns

[`UnsignedSpliceProposal`](../interfaces/UnsignedSpliceProposal.md)
