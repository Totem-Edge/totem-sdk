[**@totemsdk/txpow**](../index.md)

***

[@totemsdk/txpow](../index.md) / serializeTxHeader

# Function: serializeTxHeader()

> **serializeTxHeader**(`txBodyHash`, `options?`): `Uint8Array`

Serialize a TxHeader per Minima's TxHeader.writeDataStream().

## Parameters

### txBodyHash

`Uint8Array`

SHA3-256 of the serialized TxBody (32 bytes)

### options?

[`TxHeaderOptions`](../interfaces/TxHeaderOptions.md)

Optional nonce and timeMilli overrides

## Returns

`Uint8Array`
