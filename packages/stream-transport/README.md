# @totemsdk/stream-transport

Transport-layer abstractions for the Totem SDK — a suite of bidirectional byte-stream adapters implementing the `IStreamTransport` interface.

## Included adapters

| Adapter | Description |
|---|---|
| `NodeStreamTransport` | Wraps any Node.js `Duplex`/`Socket` stream |
| `WebSocketTransport` | Browser and Node.js WebSocket adapter |
| `WebRTCDataChannelTransport` | Browser `RTCDataChannel` adapter |
| `StdioStreamTransport` | `process.stdin` / `process.stdout` transport |
| `HyperswarmStreamTransport` | Raw Hyperswarm connection adapter |
| `InMemoryTransport` | In-process pair for unit tests |

## Installation

```bash
npm install @totemsdk/stream-transport
```

`hyperswarm` is an optional peer dependency — only needed if you use `HyperswarmStreamTransport` or `createHyperswarmTransport`.

## Quick start

```ts
import {
  InMemoryTransport,
  createInMemoryPair,
  WebSocketTransport,
  channelTopic,
} from '@totemsdk/stream-transport';

// In-process pair (great for tests)
const [a, b] = createInMemoryPair();
b.on('data', (bytes) => console.log('received', bytes));
a.send(new TextEncoder().encode('hello'));

// WebSocket
const wst = new WebSocketTransport(myWebSocket);
wst.on('data', (bytes) => { /* ... */ });
wst.send(new Uint8Array([1, 2, 3]));
```

## Topic helpers

```ts
import { channelTopic, peerTopic, broadcastTopic } from '@totemsdk/stream-transport';

const topic = channelTopic('my-channel-id'); // 32-byte Buffer (SHA3-256)
```

## License

MIT
