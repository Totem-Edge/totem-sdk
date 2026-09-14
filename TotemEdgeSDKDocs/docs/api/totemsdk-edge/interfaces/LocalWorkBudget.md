[**@totemsdk/edge**](../index.md)

***

[@totemsdk/edge](../index.md) / LocalWorkBudget

# Interface: LocalWorkBudget

Local work budget — Edge-level policy for whether the machine is willing to
perform a challenge. Cryptographic verification still depends on
challenge.target, not local timing estimates.

## Properties

### maxCumulativeWorkPerNegotiation?

> `optional` **maxCumulativeWorkPerNegotiation?**: `bigint`

Maximum cumulative expected hashes across the whole negotiation.

***

### maxEstimatedLocalMs?

> `optional` **maxEstimatedLocalMs?**: `number`

Maximum estimated local duration (ms) for a single challenge.

***

### maxExpectedHashes?

> `optional` **maxExpectedHashes?**: `bigint`

Maximum expected hashes for a single challenge.

***

### requireMinimaBacked?

> `optional` **requireMinimaBacked?**: `boolean`

Require Minima-backed proofs (superLevel >= 0) when true.
