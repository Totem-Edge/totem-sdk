[**@totemsdk/tx-builder**](../index.md)

***

[@totemsdk/tx-builder](../index.md) / addressFromPkDigest

# Function: addressFromPkDigest()

> **addressFromPkDigest**(`pkDigest32`): `string`

Replicate Minima's SIGNEDBY-address derivation from a 32-byte WOTS pk digest:
script = `RETURN SIGNEDBY(pkDigest)` → MMR leaf → Mx address. Matches the
wasm `wots_address_from_keypair_wasm` path, so a keypair's address here is
the same address a Minima node would report for that key.

## Parameters

### pkDigest32

`Uint8Array`

## Returns

`string`
