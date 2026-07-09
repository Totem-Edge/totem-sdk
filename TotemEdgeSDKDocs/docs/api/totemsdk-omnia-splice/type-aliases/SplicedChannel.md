[**@totemsdk/omnia-splice**](../index.md)

***

[@totemsdk/omnia-splice](../index.md) / SplicedChannel

# Type Alias: SplicedChannel

> **SplicedChannel** = `OmniaChannel` & `object`

A channel returned by `finalizeSplice`.

Extends OmniaChannel with splice provenance fields. The returned channel is
immediately usable for new payments: `status: 'active'`, `currentSequence: 0`,
fresh WOTS budget. `splicedFrom` identifies the old channel and
`spliceFundingCoinId` is the new on-chain UTXO.

**Mutation side effect**: `finalizeSplice` mutates the `channel` argument
(the `QuiescedChannel` passed in) by setting `status: 'spliced'` after the
splice TX is confirmed. This invalidates the old channel in-place; the
returned `SplicedChannel` (status: 'active') is the only valid live channel.

## Type Declaration

### splicedFrom

> **splicedFrom**: `string`

### spliceFundingCoinId

> **spliceFundingCoinId**: `string`

### spliceFundingTxId

> **spliceFundingTxId**: `string`

### spliceType

> **spliceType**: [`SpliceType`](SpliceType.md)
