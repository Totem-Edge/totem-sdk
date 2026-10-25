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

### settlement

> **settlement**: `"unverified"`

Always `'unverified'` here — `sendTransaction()` returns on **submission**,
not settlement. Use `awaitConfirmation()` / `sendAndConfirm()` to observe
inclusion before claiming the payment settled.

***

### status

> **status**: `"submitted"`

The TxPoW was accepted for broadcast. NOT confirmation.

***

### txpowId

> **txpowId**: `string`

Canonical TxPoW ID assigned by the Minima network (hex).
