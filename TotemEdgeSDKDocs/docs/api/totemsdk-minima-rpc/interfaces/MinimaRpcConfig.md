[**@totemsdk/minima-rpc**](../index.md)

***

[@totemsdk/minima-rpc](../index.md) / MinimaRpcConfig

# Interface: MinimaRpcConfig

Totem/Minima RPC types
Minima node HTTP RPC response shapes and client config.

## Properties

### host

> **host**: `string`

***

### maxRetries?

> `optional` **maxRetries?**: `number`

***

### password?

> `optional` **password?**: `string`

***

### port

> **port**: `number`

***

### ssl?

> `optional` **ssl?**: `boolean`

***

### timeoutMs?

> `optional` **timeoutMs?**: `number`

***

### username?

> `optional` **username?**: `string`

RPC username. Defaults to 'minima' — the totem-node's only auto-available
RPC account, which authenticates against the global -rpcpassword.
