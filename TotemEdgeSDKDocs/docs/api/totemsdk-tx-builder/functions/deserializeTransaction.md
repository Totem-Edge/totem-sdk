[**@totemsdk/tx-builder**](../index.md)

***

[@totemsdk/tx-builder](../index.md) / deserializeTransaction

# Function: deserializeTransaction()

> **deserializeTransaction**(`bytes`): `MinimaTransaction`

Deserialize a transaction produced by [serializeTransaction](serializeTransaction.md). The
inverse is byte-exact for canonically-encoded transactions (outputs/inputs
written from decimal amounts, MMR entry numbers and tokens).

## Parameters

### bytes

`Uint8Array`

## Returns

`MinimaTransaction`
