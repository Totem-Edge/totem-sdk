[**@totemsdk/minima-rpc**](../index.md)

***

[@totemsdk/minima-rpc](../index.md) / postCommand

# Function: postCommand()

> **postCommand**(`config`, `commandString`): `Promise`\<`unknown`\>

Send a single POST to the Minima RPC endpoint and return the parsed envelope.
Throws MinimaRpcError on HTTP errors or Minima status:false.

## Parameters

### config

[`MinimaRpcConfig`](../interfaces/MinimaRpcConfig.md)

### commandString

`string`

## Returns

`Promise`\<`unknown`\>
