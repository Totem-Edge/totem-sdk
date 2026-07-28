[**@totemsdk/stream-transport**](../index.md)

***

[@totemsdk/stream-transport](../index.md) / DataHandler

# Type Alias: DataHandler

> **DataHandler** = (`chunk`) => `void`

@totemsdk/stream-transport

Transport-layer abstractions for Totem SDK:
  - IStreamTransport — canonical bidirectional byte-stream interface
  - NodeStreamTransport — wraps Node.js Duplex/Socket streams
  - WebSocketTransport — browser/server WebSocket adapter
  - WebRTCDataChannelTransport — browser RTCDataChannel adapter
  - StdioStreamTransport — process stdin/stdout transport
  - HyperswarmStreamTransport — direct Hyperswarm connection adapter
  - InMemoryTransport / createInMemoryPair — in-process test helpers
  - createHyperswarmTransport — factory for Hyperswarm P2P connections
  - createWebSocketTransport — factory for WebSocket connections
  - channelTopic / peerTopic / broadcastTopic — 32-byte DHT topic helpers

## Parameters

### chunk

`Uint8Array`

## Returns

`void`
