[**@totemsdk/raster-proof**](../index.md)

***

[@totemsdk/raster-proof](../index.md) / signRasterProof

# Function: signRasterProof()

> **signRasterProof**(`unsigned`, `seed`, `keyIndex`): `SignedProof`

Sign an unsigned raster proof with a WOTS key.

The caller is responsible for reserving the WOTS key index (see
@totemsdk/wots-lease) before calling — one-time key warning applies.

## Parameters

### unsigned

`UnsignedProof`

### seed

`Uint8Array`

### keyIndex

`number`

## Returns

`SignedProof`
