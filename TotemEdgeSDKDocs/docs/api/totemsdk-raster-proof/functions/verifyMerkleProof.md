[**@totemsdk/raster-proof**](../index.md)

***

[@totemsdk/raster-proof](../index.md) / verifyMerkleProof

# Function: verifyMerkleProof()

> **verifyMerkleProof**(`proof`): `boolean`

Verify a Merkle inclusion proof against its own root. Structural check —
recomputes the root from leafHash + siblings and compares.

## Parameters

### proof

[`RasterMerkleProof`](../interfaces/RasterMerkleProof.md)

## Returns

`boolean`
