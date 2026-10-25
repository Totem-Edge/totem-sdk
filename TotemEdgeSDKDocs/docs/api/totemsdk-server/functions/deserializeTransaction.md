[**@totemsdk/server**](../index.md)

***

[@totemsdk/server](../index.md) / deserializeTransaction

# Function: deserializeTransaction()

> **deserializeTransaction**(`bytes`): [`MinimaTransaction`](../interfaces/MinimaTransaction.md)

Deserialize a transaction produced by [serializeTransaction](serializeTransactionObject.md). The
inverse is byte-exact for canonically-encoded transactions (outputs/inputs
written from decimal amounts, MMR entry numbers and tokens).

## Parameters

### bytes

`Uint8Array`

## Returns

[`MinimaTransaction`](../interfaces/MinimaTransaction.md)
