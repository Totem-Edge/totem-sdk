[**@totemsdk/spatial-proof**](../index.md)

***

[@totemsdk/spatial-proof](../index.md) / signSpatialProof

# Function: signSpatialProof()

> **signSpatialProof**(`unsigned`, `seed`, `keyIndex`): `SignedProof`

Sign an unsigned spatial proof with a WOTS key.

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
