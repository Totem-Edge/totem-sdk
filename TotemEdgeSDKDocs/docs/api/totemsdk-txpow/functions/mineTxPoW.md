[**@totemsdk/txpow**](../index.md)

***

[@totemsdk/txpow](../index.md) / mineTxPoW

# Function: mineTxPoW()

> **mineTxPoW**(`txBodyBytes`, `txnDifficulty`, `options?`): `Promise`\<[`MineResult`](../interfaces/MineResult.md)\>

Mine a TxPoW locally by iterating the header nonce until
  SHA3-256( TxHeader ) < txnDifficulty

## Parameters

### txBodyBytes

`Uint8Array`

Pre-serialized TxBody bytes (from serializeTxBody).

### txnDifficulty

`Uint8Array`

32-byte target. MUST be ≤ TX_POW_MIN_DIFFICULTY.
                     Passing MAX_HASH here will loop forever and be rejected
                     at block level by TxPoWChecker.checkTxPoWSimple().

### options?

[`MineOptions`](../interfaces/MineOptions.md)

Chunk size, max iterations, abort signal.

## Returns

`Promise`\<[`MineResult`](../interfaces/MineResult.md)\>
