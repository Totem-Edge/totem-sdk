[**@totemsdk/location-proof**](../index.md)

***

[@totemsdk/location-proof](../index.md) / signLocationProof

# Function: signLocationProof()

> **signLocationProof**(`unsigned`, `seed`, `keyIndex`): `SignedProof`

Sign an unsigned location proof with a WOTS key.

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
