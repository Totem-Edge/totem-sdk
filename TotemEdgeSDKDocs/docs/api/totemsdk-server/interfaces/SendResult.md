[**@totemsdk/server**](../index.md)

***

[@totemsdk/server](../index.md) / SendResult

# Interface: SendResult

Result returned by `sendTransaction()` on success.

## Properties

### elapsedMs

> **elapsedMs**: `number`

Wall-clock mining time in milliseconds (excludes API latency).

***

### miningSource

> **miningSource**: `"wasm"` \| `"js"`

Mining engine: `'wasm'` when the pre-compiled binary was used.

***

### status

> **status**: `"submitted"`

Always `'submitted'` on success.

***

### txpowId

> **txpowId**: `string`

Canonical TxPoW ID assigned by the Minima network (hex).
