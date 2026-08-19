[**@totemsdk/stream-transport**](../index.md)

***

[@totemsdk/stream-transport](../index.md) / TransportState

# Type Alias: TransportState

> **TransportState** = `"connecting"` \| `"open"` \| `"closing"` \| `"closed"`

@totemsdk/stream-transport

Transport-layer abstractions for Totem SDK.

The canonical transport contract is `IStreamTransport`:

  - `state`              — explicit connection state
  - `send(data)`         — async send; resolves when the bytes are accepted by
                           the underlying transport or the documented backpressure
                           policy is applied; rejects after close or on error.
  - `onData`/`onClose`/`onError` — subscribe and receive an unsubscribe function.
  - `close()`            — async close with predictable semantics (no further
                           deliveries after the returned promise resolves).

Implementations: NodeStreamTransport, WebSocketTransport,
WebRTCDataChannelTransport, StdioStreamTransport, HyperswarmStreamTransport,
and InMemoryTransport / createInMemoryPair for tests.

Topic helpers (channelTopic / peerTopic / broadcastTopic) are Node-only
(they return Buffer) and are used by the Omnia swarm in Node environments.
