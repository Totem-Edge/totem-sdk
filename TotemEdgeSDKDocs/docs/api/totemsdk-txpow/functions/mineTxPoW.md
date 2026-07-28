[**@totemsdk/txpow**](../index.md)

***

[@totemsdk/txpow](../index.md) / mineTxPoW

# Function: mineTxPoW()

> **mineTxPoW**(`txBodyBytes`, `txnDifficulty`, `options?`): `Promise`\<[`MineResult`](../interfaces/MineResult.md)\>

Mine a TxPoW locally by iterating the header nonce until
  SHA3-256( TxHeader ) < txnDifficulty

In Node.js (main thread), delegates to a `worker_threads` Worker so the
event loop is never blocked. In browsers or Jest, runs in-process with
periodic `setImmediate`/`setTimeout(0)` yields between chunks.

Uses the pre-compiled `miner.wasm` binary for inner-loop throughput when
available. Falls back to pure JS automatically when the binary is absent.

## Parameters

### txBodyBytes

`Uint8Array`

Pre-serialized TxBody bytes (from serializeTxBody).

### txnDifficulty

`Uint8Array`

32-byte target. MUST be ≤ TX_POW_MIN_DIFFICULTY.

### options?

[`MineOptions`](../interfaces/MineOptions.md)

Chunk size, max iterations, abort signal, timeMilli override.

## Returns

`Promise`\<[`MineResult`](../interfaces/MineResult.md)\>
