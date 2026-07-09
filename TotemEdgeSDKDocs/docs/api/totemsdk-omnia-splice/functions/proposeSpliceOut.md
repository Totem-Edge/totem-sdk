[**@totemsdk/omnia-splice**](../index.md)

***

[@totemsdk/omnia-splice](../index.md) / proposeSpliceOut

# Function: proposeSpliceOut()

> **proposeSpliceOut**(`channel`, `withdrawAmount`, `withdrawAddress`, `leaseProvider`, `newBalances?`, `extraOutputs?`): `Promise`\<[`SpliceProposal`](../interfaces/SpliceProposal.md)\>

Initiating party proposes a splice-out: withdraw funds from the channel on-chain.

Requires the channel to be in 'quiesced' state (see quiesceChannel).

WOTS lease safety: reserves a key slot before signing (same semantics as
proposeSpliceIn). The `proposerReservationId` in the returned `SpliceProposal`
must be committed/burned by `finalizeSplice`.

## Parameters

### channel

`OmniaChannel` \| [`QuiescedChannel`](../type-aliases/QuiescedChannel.md)

Quiesced channel.

### withdrawAmount

`bigint`

Amount to remove from the channel.

### withdrawAddress

`string`

On-chain destination for the withdrawn funds.

### leaseProvider

[`SpliceLeaseProvider`](../interfaces/SpliceLeaseProvider.md)

Provides the proposer signer and WOTS lease.

### newBalances?

`Record`\<`string`, `bigint`\>

How the remaining total should be split after splice.

### extraOutputs?

`object`[]

Optional additional on-chain outputs (third-party payments).

## Returns

`Promise`\<[`SpliceProposal`](../interfaces/SpliceProposal.md)\>

SpliceProposal signed by the proposer with lease reservation data.
