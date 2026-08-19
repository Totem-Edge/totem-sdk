[**@totemsdk/location-proof**](../index.md)

***

[@totemsdk/location-proof](../index.md) / createUnsignedLocationProof

# Function: createUnsignedLocationProof()

> **createUnsignedLocationProof**(`params`): `UnsignedProof`

Create an unsigned attestation proof for a location claim.

The proof claims: "this device identity claimed this position, at this
time, with this source context, optionally linked to a challenge and
corroboration." It does NOT claim absolute or legally conclusive truth.

## Parameters

### params

[`CreateLocationProofParams`](../interfaces/CreateLocationProofParams.md)

## Returns

`UnsignedProof`
