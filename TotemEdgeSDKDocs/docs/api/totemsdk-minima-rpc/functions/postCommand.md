[**@totemsdk/minima-rpc**](../index.md)

***

[@totemsdk/minima-rpc](../index.md) / postCommand

# Function: postCommand()

> **postCommand**(`config`, `commandString`, `opts?`): `Promise`\<`unknown`\>

Send a single POST to the Minima RPC endpoint and return the parsed envelope.
Throws MinimaRpcError on HTTP errors or Minima status:false.

## Parameters

### config

[`MinimaRpcConfig`](../interfaces/MinimaRpcConfig.md)

### commandString

`string`

### opts?

#### retryable?

`boolean`

When true, ambiguous network failures are retried (up to
  `config.maxRetries`) and the tolerant raw HTTP transport may be used as a
  fallback. Defaults to false: ambiguous failures surface immediately without
  repeating a possibly non-idempotent command.

## Returns

`Promise`\<`unknown`\>
