[**@totemsdk/proof**](../index.md)

***

[@totemsdk/proof](../index.md) / OraclePolicy

# Interface: OraclePolicy

## Properties

### aggregation

> **aggregation**: [`OracleAggregation`](../type-aliases/OracleAggregation.md)

***

### agreementBps?

> `optional` **agreementBps?**: `number`

threshold-agreement: fraction (bps) of the quorum that must be within the band.

***

### authorizedPublishers

> **authorizedPublishers**: `string`[]

Publishers authorized to sign for this feed.

***

### feedId

> **feedId**: `string`

***

### freezeOnDisagreement?

> `optional` **freezeOnDisagreement?**: `boolean`

On any source outside the deviation band, `freeze` rejects the whole set (fail
closed). Default: freeze. (Override/freeze policy on disagreement, RFC-048 §3.1.)

***

### maxAgeMs

> **maxAgeMs**: `number`

Reject observations older than this at `nowMs`.

***

### maxDeviationBps

> **maxDeviationBps**: `number`

Max deviation (basis points) from the median for acceptance.

***

### maxFutureDriftMs

> **maxFutureDriftMs**: `number`

Reject observations dated further than this into the future.

***

### minQuorum

> **minQuorum**: `number`

Minimum number of distinct independent sources required.

***

### scale

> **scale**: `number`

***

### unit

> **unit**: `string`
