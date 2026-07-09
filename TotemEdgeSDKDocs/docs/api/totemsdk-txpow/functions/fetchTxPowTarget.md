[**@totemsdk/txpow**](../index.md)

***

[@totemsdk/txpow](../index.md) / fetchTxPowTarget

# Function: fetchTxPowTarget()

> **fetchTxPowTarget**(`axiaBaseUrl`, `timeoutMs?`): `Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

Fetch the current minimum TxPoW work from the Axia API.

Falls back to TX_POW_MIN_DIFFICULTY (the hardcoded protocol floor) on any
error: network failure, timeout, or malformed response.

## Parameters

### axiaBaseUrl

`string`

Base URL of the Axia API, e.g. "https://api.axia.to"

### timeoutMs?

`number` = `3000`

Request timeout in ms (default: 3000)

## Returns

`Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>
