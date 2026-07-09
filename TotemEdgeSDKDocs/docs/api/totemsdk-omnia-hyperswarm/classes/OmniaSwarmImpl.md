[**@totemsdk/omnia-hyperswarm**](../index.md)

***

[@totemsdk/omnia-hyperswarm](../index.md) / OmniaSwarmImpl

# Class: OmniaSwarmImpl

@totemsdk/omnia-hyperswarm

Hyperswarm P2P transport adapter for @totemsdk/omnia payment channels.

Quick start:

```ts
import { createOmniaSwarm, createOmniaIntegration } from '@totemsdk/omnia-hyperswarm';

const swarm = await createOmniaSwarm();
const store = new Map();

// Fully-wired: accepts inbound proposals and binds per-peer handlers automatically
const unsub = createOmniaIntegration(swarm, store, {
  leaseProvider,   // WotsLeaseProvider for signState / proposeSettlement
  onChannelAccepted: (channel, peer) => console.log('new channel', channel.channelId),
  onStateUpdated:   (channel, peer) => console.log('state updated', channel.currentSequence),
});

// Or connect to a specific peer manually:
const peer = await swarm.connectToPeer(remotePubkeyHex, channelId);
const unsubPeer = bindPeerIntegration(peer, store, { leaseProvider });
await peer.sendMessage({ type: 'CHANNEL_PROPOSAL', channelId, nonce: 1, payload: proposal });
```

## Implements

- [`OmniaSwarm`](../interfaces/OmniaSwarm.md)

## Constructors

### Constructor

> **new OmniaSwarmImpl**(`swarm`, `config?`): `OmniaSwarmImpl`

#### Parameters

##### swarm

`any`

##### config?

[`OmniaSwarmConfig`](../interfaces/OmniaSwarmConfig.md) = `{}`

#### Returns

`OmniaSwarmImpl`

## Methods

### advertise()

> **advertise**(`localPubkey`): `void`

Advertise this node on the peer-discovery topic for `localPubkey` so remote
nodes can connect to us via `connectToPeer(localPubkey)`.

Derived topic: SHA3-256('omnia:peer:' + localPubkey).
Safe to call multiple times — repeated calls for the same pubkey are no-ops.

#### Parameters

##### localPubkey

`string`

#### Returns

`void`

#### Implementation of

[`OmniaSwarm`](../interfaces/OmniaSwarm.md).[`advertise`](../interfaces/OmniaSwarm.md#advertise)

***

### broadcast()

> **broadcast**(`topic`, `msg`): `Promise`\<`void`\>

Send a message to all peers currently subscribed to the derived Hyperswarm topic.

Joins the Hyperswarm topic key `SHA3-256('omnia:' + topic)` so new peers can
discover this node. Delivers to all already-connected peers tracked under that
topic. New peers connecting after this call will be tracked for future broadcasts.

#### Parameters

##### topic

`string`

##### msg

[`OmniaMessage`](../interfaces/OmniaMessage.md)

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`OmniaSwarm`](../interfaces/OmniaSwarm.md).[`broadcast`](../interfaces/OmniaSwarm.md#broadcast)

***

### close()

> **close**(): `Promise`\<`void`\>

Gracefully shut down the swarm, disconnecting all peers.

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`OmniaSwarm`](../interfaces/OmniaSwarm.md).[`close`](../interfaces/OmniaSwarm.md#close)

***

### connectToPeer()

> **connectToPeer**(`pubkey`, `channelId?`): `Promise`\<[`OmniaPeer`](../interfaces/OmniaPeer.md)\>

Connect to a specific peer by their 32-byte hex pubkey.
Joins the Hyperswarm topic SHA3-256('omnia:peer:' + pubkey) and waits for
a connection from a node with the matching public key. The remote node must
have called `advertise(pubkey)` or set `localPubkey` in its config.
Optional channelId associates the peer with a specific channel.

#### Parameters

##### pubkey

`string`

##### channelId?

`string`

#### Returns

`Promise`\<[`OmniaPeer`](../interfaces/OmniaPeer.md)\>

#### Implementation of

[`OmniaSwarm`](../interfaces/OmniaSwarm.md).[`connectToPeer`](../interfaces/OmniaSwarm.md#connecttopeer)

***

### listenForChannels()

> **listenForChannels**(`onProposal`): [`Unsubscribe`](../type-aliases/Unsubscribe.md)

Register a handler for inbound CHANNEL_PROPOSAL messages from any peer.
Returns an unsubscribe function.

#### Parameters

##### onProposal

(`peer`, `proposal`) => `void`

#### Returns

[`Unsubscribe`](../type-aliases/Unsubscribe.md)

#### Implementation of

[`OmniaSwarm`](../interfaces/OmniaSwarm.md).[`listenForChannels`](../interfaces/OmniaSwarm.md#listenforchannels)
