[**@totemsdk/omnia-vtxo**](../index.md)

***

[@totemsdk/omnia-vtxo](../index.md) / PoolFundingCheck

# Interface: PoolFundingCheck

## Properties

### coin?

> `optional` **coin?**: `object`

#### address

> **address**: `string`

#### amount

> **amount**: `string`

#### spent

> **spent**: `boolean`

#### tokenId

> **tokenId**: `string`

***

### coinId

> **coinId**: `string`

***

### error?

> `optional` **error?**: `string`

***

### ok

> **ok**: `boolean`

***

### proof?

> `optional` **proof?**: `unknown`

The fetched MMR proof (present when `ok` and the node served one).

***

### proofVerified

> **proofVerified**: `boolean`

Whether the MMR proof was cryptographically verified. `false` unless a
`verifyProof` callback was supplied — this function checks existence,
address/amount/token match, and unspent status, but does NOT itself verify the
proof against the tip. Pass `verifyProof` to verify it (RFC-038 §3.3 open).
