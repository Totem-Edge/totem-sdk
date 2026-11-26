[**@totemsdk/vtxo**](../index.md)

***

[@totemsdk/vtxo](../index.md) / ComputeVtxoIdParams

# Interface: ComputeVtxoIdParams

## Properties

### amount

> **amount**: `bigint`

***

### epoch?

> `optional` **epoch?**: `number`

OMN-046: replacement outputs include the epoch so a refresh can never
reproduce its own input id (which would overwrite the consumed record).

***

### nonce

> **nonce**: `string`

***

### owner

> **owner**: `string`

***

### poolId

> **poolId**: `string`

***

### tokenId

> **tokenId**: `string`
