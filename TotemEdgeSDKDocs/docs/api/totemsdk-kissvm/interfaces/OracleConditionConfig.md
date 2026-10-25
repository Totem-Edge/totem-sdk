[**@totemsdk/kissvm**](../index.md)

***

[@totemsdk/kissvm](../index.md) / OracleConditionConfig

# Interface: OracleConditionConfig

## Properties

### beneficiary?

> `optional` **beneficiary?**: `string`

When set, the witness pays the whole balance to this beneficiary.

***

### comparison

> **comparison**: `object`

Objective comparison applied to the committed value.

#### op

> **op**: [`OracleComparisonOp`](../type-aliases/OracleComparisonOp.md)

#### valueAtoms

> **valueAtoms**: `bigint`

***

### feedPort?

> `optional` **feedPort?**: `number`

State port carrying the feed/schema commitment. Default 123.

***

### observedAtPort?

> `optional` **observedAtPort?**: `number`

State port carrying the observation's earliest-valid block. Default 121.

***

### oracles

> **oracles**: `string`[]

Authorized oracle public-key digests (hex). One = single-trusted, N = quorum.

***

### requireSequenceAdvance?

> `optional` **requireSequenceAdvance?**: `boolean`

Require the committed sequence to strictly advance. Default false.

***

### sequencePort?

> `optional` **sequencePort?**: `number`

State port carrying the anti-replay sequence. Default 124.

***

### threshold?

> `optional` **threshold?**: `number`

Quorum threshold. Defaults to all oracles.

***

### tokenId?

> `optional` **tokenId?**: `string`

Asset id (hex). Defaults to `0x00` (MINIMA).

***

### validUntilPort?

> `optional` **validUntilPort?**: `number`

State port carrying the observation's expiry block. Default 122.

***

### valuePort?

> `optional` **valuePort?**: `number`

State port carrying the observation value. Default 120.
