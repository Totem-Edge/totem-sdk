[**@totemsdk/txpow**](../index.md)

***

[@totemsdk/txpow](../index.md) / isWasmAvailable

# Function: isWasmAvailable()

> **isWasmAvailable**(): `Promise`\<`boolean`\>

Returns true when the WASM binary is loaded and `mine` is ready to use.
Cached after the first call; subsequent calls are synchronous (via memoised flag).

## Returns

`Promise`\<`boolean`\>
