[**@totemsdk/pureminima-rpc**](../index.md)

***

[@totemsdk/pureminima-rpc](../index.md) / postCommand

# Function: postCommand()

> **postCommand**(`config`, `commandString`): `Promise`\<`unknown`\>

Send a single POST to the Minima RPC endpoint and return the parsed envelope.
Throws PureMinimaRpcError on HTTP errors or Minima status:false.

## Parameters

### config

[`PureMinimaConfig`](../interfaces/PureMinimaConfig.md)

### commandString

`string`

## Returns

`Promise`\<`unknown`\>
