[**@totemsdk/stream-transport**](../index.md)

***

[@totemsdk/stream-transport](../index.md) / createHyperswarmTransport

# Function: createHyperswarmTransport()

> **createHyperswarmTransport**(`config`): `Promise`\<[`HyperswarmStreamTransport`](../classes/HyperswarmStreamTransport.md)\>

Establishes a Hyperswarm connection and returns IStreamTransport.
Dynamically imports `hyperswarm` so the package remains optional at build time.

## Parameters

### config

[`HyperswarmTransportConfig`](../interfaces/HyperswarmTransportConfig.md)

## Returns

`Promise`\<[`HyperswarmStreamTransport`](../classes/HyperswarmStreamTransport.md)\>
