[**@totemsdk/p2p-hub**](../index.md)

***

[@totemsdk/p2p-hub](../index.md) / createWebSocketHubServer

# Function: createWebSocketHubServer()

> **createWebSocketHubServer**(`options`): `Promise`\<[`WebSocketHubServer`](../interfaces/WebSocketHubServer.md)\>

Create a loopback WebSocket server in front of a hub. Defaults to 127.0.0.1;
non-loopback binds are the caller's explicit responsibility.

## Parameters

### options

[`WebSocketHubServerOptions`](../interfaces/WebSocketHubServerOptions.md)

## Returns

`Promise`\<[`WebSocketHubServer`](../interfaces/WebSocketHubServer.md)\>
