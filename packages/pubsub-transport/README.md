# @totemsdk/pubsub-transport

Publish-subscribe transport abstractions for the Totem SDK — MQTT-compatible interfaces and in-process implementations for wiring and testing pub/sub message flows.

## Exports

| Export | Description |
|---|---|
| `IPubSubTransport` | Canonical pub/sub interface (MQTT semantics) |
| `PubSubMessage` | Inbound message type `{ topic, payload }` |
| `PubSubSubscription` | Subscription handle with `unsubscribe()` |
| `EventEmitterTransport` | In-process `EventEmitter`-backed transport |
| `MockPubSubTransport` | Test mock with `inject()` and recorded calls |
| `MqttClientPort` | Type alias for `IPubSubTransport` (backward compat) |
| `MqttMessage` | Type alias for `PubSubMessage` |
| `WebSocketPubSubTransport` | Local-hub WebSocket client (JSON frames, base64 payloads) |
| `HubClientFrame` / `HubServerFrame` | P2P hub wire protocol |
| `bytesToBase64` / `base64ToBytes` | Cross-runtime payload helpers |

## Installation

```bash
npm install @totemsdk/pubsub-transport
```

No required peer dependencies for the core/interfaces. The WebSocket hub client
uses the platform `WebSocket` (or an injected implementation).

## Quick start

```ts
import {
  EventEmitterTransport,
  createPairedEventEmitterTransports,
  MockPubSubTransport,
} from '@totemsdk/pubsub-transport';

// Bidirectional in-process pair
const [alice, bob] = createPairedEventEmitterTransports();
await alice.connect();
await bob.connect();

bob.onMessage((msg) => console.log('bob got', msg.topic, msg.payload));
await alice.subscribe('updates');
await alice.publish('updates', new TextEncoder().encode('hello'));

// Mock transport for unit tests
const mock = new MockPubSubTransport();
await mock.connect();
await mock.publish('foo', 'bar');
console.log(mock.published); // [{ topic: 'foo', payload: 'bar' }]
mock.inject('incoming', 'data'); // simulate broker delivery
```

## Implementing a custom transport

```ts
import type { IPubSubTransport, PubSubMessage, PubSubSubscription } from '@totemsdk/pubsub-transport';

class MyTransport implements IPubSubTransport {
  async connect() { /* ... */ }
  async disconnect() { /* ... */ }
  async subscribe(topic: string): Promise<PubSubSubscription> { /* ... */ }
  async publish(topic: string, payload: string | Uint8Array): Promise<void> { /* ... */ }
  onMessage(handler: (message: PubSubMessage) => void): () => void { /* ... */ }
}
```

## License

Apache-2.0 — see [LICENSE](./LICENSE) and [NOTICE](./NOTICE).
