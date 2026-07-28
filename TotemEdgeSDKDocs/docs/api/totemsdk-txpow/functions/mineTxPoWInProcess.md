[**@totemsdk/txpow**](../index.md)

***

[@totemsdk/txpow](../index.md) / mineTxPoWInProcess

# Function: mineTxPoWInProcess()

> **mineTxPoWInProcess**(`txBodyBytes`, `txnDifficulty`, `options?`): `Promise`\<[`MineResult`](../interfaces/MineResult.md)\>

Run the mining loop in the current thread/task.
Called directly by the Node.js worker, and by the browser code path.

## Parameters

### txBodyBytes

`Uint8Array`

### txnDifficulty

`Uint8Array`

### options?

[`MineOptions`](../interfaces/MineOptions.md)

## Returns

`Promise`\<[`MineResult`](../interfaces/MineResult.md)\>
