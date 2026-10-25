[**@totemsdk/txpow**](../index.md)

***

[@totemsdk/txpow](../index.md) / resolveTxPowTarget

# Function: resolveTxPowTarget()

> **resolveTxPowTarget**(`source?`, `fallback?`): `Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

Resolve the TxPoW mining target from a live node when it exposes
`getMinTxPowWork()`, otherwise fall back to `TX_POW_MIN_DIFFICULTY`.

Never throws: a node/protocol hiccup must not block transaction
construction. The fallback is the protocol default target (MAX/1e6), which
is harder than the network hard floor (`Magic.MIN_HASHES = 10000`).

## Parameters

### source?

[`MinWorkSource`](../interfaces/MinWorkSource.md) \| `null`

### fallback?

`Uint8Array` = `TX_POW_MIN_DIFFICULTY`

## Returns

`Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>
