[**@totemsdk/omnia-vtxo**](../index.md)

***

[@totemsdk/omnia-vtxo](../index.md) / computeBatchCommitment

# Function: computeBatchCommitment()

> **computeBatchCommitment**(`poolId`, `epoch`, `root`, `orderedIds`): `string`

Canonical batch commitment (RFC-038 §3.2): the operator signs this over the
pool, epoch, Merkle root, and the ordered VTXO ids in the batch.

## Parameters

### poolId

`string`

### epoch

`number`

### root

`string`

### orderedIds

readonly `string`[]

## Returns

`string`
