[**@totemsdk/omnia-splice**](../index.md)

***

[@totemsdk/omnia-splice](../index.md) / buildSpliceOutProposal

# Function: buildSpliceOutProposal()

> **buildSpliceOutProposal**(`channel`, `withdrawAmount`, `withdrawAddress`, `proposerPublicKeyDigest`, `newBalances?`, `extraOutputs?`): [`UnsignedSpliceProposal`](../interfaces/UnsignedSpliceProposal.md)

Build an unsigned splice-out proposal (see `buildSpliceProposal`).

## Parameters

### channel

`OmniaChannel` \| [`QuiescedChannel`](../type-aliases/QuiescedChannel.md)

### withdrawAmount

`bigint`

### withdrawAddress

`string`

### proposerPublicKeyDigest

`string`

### newBalances?

`Record`\<`string`, `bigint`\>

### extraOutputs?

`object`[]

## Returns

[`UnsignedSpliceProposal`](../interfaces/UnsignedSpliceProposal.md)
