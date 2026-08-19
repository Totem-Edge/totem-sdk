[**@totemsdk/raster-proof**](../index.md)

***

[@totemsdk/raster-proof](../index.md) / merkleLeafHash

# Function: merkleLeafHash()

> **merkleLeafHash**(`chunk`): `string`

Domain-separated Merkle leaf hash for a chunk. A user proving "this chunk
is in this tree" recomputes merkleLeafHash(chunk) and compares it to
RasterMerkleProof.leafHash before verifying the sibling chain.

## Parameters

### chunk

[`RasterChunk`](../interfaces/RasterChunk.md)

## Returns

`string`
