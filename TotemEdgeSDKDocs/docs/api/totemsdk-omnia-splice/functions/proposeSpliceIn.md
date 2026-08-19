[**@totemsdk/omnia-splice**](../index.md)

***

[@totemsdk/omnia-splice](../index.md) / proposeSpliceIn

# Function: proposeSpliceIn()

> **proposeSpliceIn**(`channel`, `additionalCoinId`, `additionalAmount`, `leaseProvider`, `newBalances?`): `Promise`\<[`SpliceProposal`](../interfaces/SpliceProposal.md)\>

Initiating party proposes a splice-in: add external funds to the channel.

Requires the channel to be in 'quiesced' state (see quiesceChannel).

WOTS lease safety: a key slot is reserved via `leaseProvider.wotsLease`
before signing. The returned `proposerReservationId` and
`proposerSigningIndices` must be passed through to `finalizeSplice`
(embedded in the `SpliceProposal`) so the reservation is committed on
success or burned on failure, preventing one-time-key reuse.

## Parameters

### channel

`OmniaChannel` \| [`QuiescedChannel`](../type-aliases/QuiescedChannel.md)

Quiesced channel to splice.

### additionalCoinId

`string`

CoinId of the external coin being spliced in.

### additionalAmount

`bigint`

Amount of the additional coin.

### leaseProvider

[`SpliceLeaseProvider`](../interfaces/SpliceLeaseProvider.md)

Provides the proposer signer and WOTS lease.

### newBalances?

`Record`\<`string`, `bigint`\>

How the new total should be split after splice.
                           When omitted, existing balances are scaled
                           proportionally to the new total value so that
                           `sum(newBalances) === newTotalValue` is preserved.

## Returns

`Promise`\<[`SpliceProposal`](../interfaces/SpliceProposal.md)\>

SpliceProposal signed by the proposer with lease reservation data.
