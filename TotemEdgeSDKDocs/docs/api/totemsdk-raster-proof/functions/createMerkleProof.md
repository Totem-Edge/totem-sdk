[**@totemsdk/raster-proof**](../index.md)

***

[@totemsdk/raster-proof](../index.md) / createMerkleProof

# Function: createMerkleProof()

> **createMerkleProof**(`chunks`, `leafIndex`): [`RasterMerkleProof`](../interfaces/RasterMerkleProof.md)

Build a Merkle inclusion proof for one chunk. The proof's leafHash is the
domain-separated leaf hash of that chunk. Callers can reproduce it with
merkleLeafHash(chunks[leafIndex]).

## Parameters

### chunks

[`RasterChunk`](../interfaces/RasterChunk.md)[]

### leafIndex

`number`

## Returns

[`RasterMerkleProof`](../interfaces/RasterMerkleProof.md)
