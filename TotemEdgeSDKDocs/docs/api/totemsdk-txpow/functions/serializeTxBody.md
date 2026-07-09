[**@totemsdk/txpow**](../index.md)

***

[@totemsdk/txpow](../index.md) / serializeTxBody

# Function: serializeTxBody()

> **serializeTxBody**(`txBytes`, `witnessBytes`, `options?`): `Uint8Array`

Serialize a TxBody per Minima's TxBody.writeDataStream().

## Parameters

### txBytes

`Uint8Array`

Pre-serialized Transaction bytes (from @totemsdk/core's serializeTransaction)

### witnessBytes

`Uint8Array`

Pre-serialized Witness bytes (from extension's serializeWitness)

### options?

[`TxBodyOptions`](../interfaces/TxBodyOptions.md)

Optional txnDifficulty override and test PRNG

## Returns

`Uint8Array`
