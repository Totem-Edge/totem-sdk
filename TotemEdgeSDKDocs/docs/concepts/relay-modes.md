---
title: Relay Modes
sidebar_label: Relay Modes
description: Choose between native Hyperswarm P2P, Axia-hosted relay, and self-hosted relay in @totemsdk/omnia-hyperswarm.
---

# Relay Modes

`@totemsdk/omnia-hyperswarm` supports three transport modes for Omnia payment channel peer discovery. You pick the mode by setting the `relay` field in `OmniaSwarmConfig`.

## native (default)

Raw Hyperswarm P2P. The `hyperswarm` npm package must be installed as a peer dependency. This mode dials directly into the Hyperswarm DHT and is ideal for Node.js, Pear, and Bare environments where UDP is available.

```ts
import { createOmniaSwarm } from '@totemsdk/omnia-hyperswarm';

// No relay config → 'native' is implied
const swarm = await createOmniaSwarm({ localPubkey: myPubkeyHex });
```

**Requirements:** `npm install hyperswarm`  
**Works in:** Node.js ≥ 18, Pear, Bare  
**Does NOT work in:** Browsers, sandboxed environments, most serverless runtimes

---

## hosted

Axia manages the relay infrastructure for you. Pass your Axia API key; no Hyperswarm binary is needed. Traffic is billed against your project's credit balance (10 credits per connection + 2 credits per 50-message batch).

```ts
import { createOmniaSwarm } from '@totemsdk/omnia-hyperswarm';

const swarm = await createOmniaSwarm({
  localPubkey: myPubkeyHex,
  relay: {
    mode: 'hosted',
    apiKey: 'axia_your_key_here',
    // endpoint defaults to wss://api.axia.to/api/relay/ws
  },
});
```

**Requirements:** An active Axia API key (get one from the [Dashboard](https://app.axia.to/keys))  
**Works in:** Browsers, Node.js, serverless, restricted environments  
**Credit cost:** 10 credits on connect + 2 credits per 50-message batch (every 10 s)  
**Close code 4402:** Sent when credit limit is reached — reconnect after topping up

### Getting your API key

1. Open the [Axia Dashboard → API Keys](https://app.axia.to/keys).
2. Copy any active key.
3. Pass it as `apiKey` in the relay config.

The relay WebSocket URL is displayed in the **Relay Endpoints** section at the bottom of the API Keys page.

---

## self-hosted

Point the swarm at your own relay node running the Axia DHT Relay Bridge protocol. Useful for air-gapped environments, private deployments, or testing.

```ts
import { createOmniaSwarm } from '@totemsdk/omnia-hyperswarm';

const swarm = await createOmniaSwarm({
  localPubkey: myPubkeyHex,
  relay: {
    mode: 'self-hosted',
    relayUrl: 'wss://relay.example.com',
  },
});

// Or use the convenience function:
import { createOmniaSwarmFromRelayUrl } from '@totemsdk/omnia-hyperswarm';
const swarm2 = createOmniaSwarmFromRelayUrl('wss://relay.example.com', { localPubkey });
```

**Requirements:** A relay node running `DhtRelayBridge` from `@axia/api` (the same one backing the hosted endpoint)  
**Works in:** Any environment with WebSocket support  
**Credit cost:** None (your own infrastructure)

---

## How the relay protocol works

The hosted and self-hosted modes both use the same JSON pub/sub protocol over WebSocket — the same one that powers the PIPE DHT Relay Bridge:

| Direction | Message |
|---|---|
| Client → Relay | `{ type: 'sub', topic: '<hex>' }` |
| Client → Relay | `{ type: 'pub', topic: '<hex>', env: { id, frame: '<hex bytes>' } }` |
| Relay → Client | `{ type: 'msg', topic: '<hex>', env: { id, frame: '<hex bytes>' } }` |

Topics are the same SHA3-256-keyed strings used by native Hyperswarm:
- `peerTopic(pubkey)` — peer discovery
- `channelTopic('channels')` — inbound channel proposals  
- `broadcastTopic(topic)` — fanout messages

OmniaMessage binary frames (4-byte length prefix + UTF-8 JSON) are hex-encoded into `env.frame`. The relay deduplicates on `env.id` and fans out to all subscribers on the same topic.

---

## Choosing a mode

| Scenario | Mode |
|---|---|
| Node.js / Pear / Bare server | `native` |
| Browser dApp | `hosted` |
| Restricted cloud environment | `hosted` or `self-hosted` |
| Private/air-gapped deployment | `self-hosted` |
| Development / CI testing | `native` (with mock stream pair) or `self-hosted` |

For local development and tests, prefer `createMockStreamPair()` from `@totemsdk/omnia-hyperswarm` to avoid any network dependency.
