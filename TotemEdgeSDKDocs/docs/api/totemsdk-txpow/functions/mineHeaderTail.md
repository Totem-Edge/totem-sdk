[**@totemsdk/txpow**](../index.md)

***

[@totemsdk/txpow](../index.md) / mineHeaderTail

# Function: mineHeaderTail()

> **mineHeaderTail**(`headerTail`, `target`, `options?`): `Promise`\<[`MineResult`](../interfaces/MineResult.md)\>

Core mining loop over a pre-built header tail.

Iterates the nonce in the serialized TxHeader (nonce value at offset 2,
followed by `headerTail`) until `SHA3-256(header) < target`. Shared by the
transaction miner (`mineTxPoWInProcess`) and the Machine Work Admission
miner (`admission/mine.ts`), which supplies its own block-candidate tail.

## Parameters

### headerTail

`Uint8Array`

Serialized TxHeader bytes AFTER the nonce field.

### target

`Uint8Array`

32-byte difficulty target (big-endian 256-bit).

### options?

[`MineOptions`](../interfaces/MineOptions.md)

Chunk size, max iterations, abort signal, timeMilli override.

## Returns

`Promise`\<[`MineResult`](../interfaces/MineResult.md)\>
