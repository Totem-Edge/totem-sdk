[**@totemsdk/connect**](../index.md)

***

[@totemsdk/connect](../index.md) / createWalletRuntime

# Function: createWalletRuntime()

> **createWalletRuntime**(`ctx`, `options?`): [`WalletRuntime`](../interfaces/WalletRuntime.md)

Compose a wallet runtime over the shared handlers. Every canonical connect
method is addressable; methods whose ports are absent resolve to an explicit
`unsupported` response (and are listed in the manifest), never a silent no-op.

## Parameters

### ctx

[`WalletHandlerContext`](../interfaces/WalletHandlerContext.md)

### options?

[`WalletRuntimeOptions`](../interfaces/WalletRuntimeOptions.md) = `{}`

## Returns

[`WalletRuntime`](../interfaces/WalletRuntime.md)
