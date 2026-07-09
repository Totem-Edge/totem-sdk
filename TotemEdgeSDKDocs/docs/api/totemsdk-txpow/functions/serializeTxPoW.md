[**@totemsdk/txpow**](../index.md)

***

[@totemsdk/txpow](../index.md) / serializeTxPoW

# Function: serializeTxPoW()

> **serializeTxPoW**(`txBytes`, `witnessBytes`, `options?`): `Uint8Array`

Serialize a complete TxPoW per Minima's TxPoW.writeDataStream().

Assembles TxBody from pre-serialized tx+witness bytes, hashes the body to
obtain mTxBodyHash, builds TxHeader with nonce=0, then concatenates:
  TxHeader | 0x01 (hasBody) | TxBody

The returned bytes have nonce=0. Pass them to mineTxPoW() to find a valid
nonce for local mining, or send as-is when MEG will re-mine.

## Parameters

### txBytes

`Uint8Array`

Pre-serialized Transaction bytes

### witnessBytes

`Uint8Array`

Pre-serialized Witness bytes

### options?

[`TxPoWOptions`](../type-aliases/TxPoWOptions.md)

Optional txnDifficulty, nonce, timeMilli, prng

## Returns

`Uint8Array`
