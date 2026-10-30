# @totemsdk/p2p-hub

One local process owns a single **Hyperswarm** instance and exposes a loopback
WebSocket bridge. Browser/native Totem apps connect with
`@totemsdk/pubsub-transport` and never start their own DHT node.

```text
apps / dapps ── WebSocket ── p2p-hub ── Hyperswarm ── peers
```

The hub is a dumb, authenticated pipe. It forwards signed application payloads and
applies transport policy only:

- bearer-token auth (`hello` frame),
- optional topic allowlist,
- payload size and per-client rate limits,
- loopback binding by default.

It never verifies application signatures or holds keys.

## Server

```ts
import { createHyperswarmHubNetwork, createWebSocketHubServer } from '@totemsdk/p2p-hub';

const network = await createHyperswarmHubNetwork();
const server = await createWebSocketHubServer({
  network,
  host: '127.0.0.1',
  port: 7788,
  token: process.env.P2P_HUB_TOKEN,
  allowedOrigins: ['chrome-extension://<extension-id>', 'https://app.totem.ing'],
  allowedTopicPrefixes: ['omnia', 'dex.v1'],
});

await server.listen();
```

## Client

```ts
import { WebSocketPubSubTransport } from '@totemsdk/pubsub-transport';

const transport = new WebSocketPubSubTransport({
  url: 'ws://127.0.0.1:7788/p2p',
  token: process.env.P2P_HUB_TOKEN,
});

await transport.connect();
const sub = await transport.subscribe('dex.v1.orders.MINIMA_USDT');
transport.onMessage((msg) => console.log(msg.topic, msg.payload));
await transport.publish('dex.v1.orders.MINIMA_USDT', signedEnvelopeBytes);
```

## Architecture notes

- One swarm = one DHT identity/NAT mapping. Multiple apps share the transport, not
  the same topic ACL.
- Topics are namespaced by app (`omnia.*`, `dex.v1.*`, etc.).
- Browser clients must use the loopback bridge; they cannot join Hyperswarm.
- Use `deriveTopicKey(topic)` when native peers need the exact 32-byte DHT key.
- Pairing/endpoint discovery is defined by RFC-062.


## Testing

Tests live outside the published package in `tests/unit/p2p-hub/`. Package `test:*` scripts are repository delegates.
