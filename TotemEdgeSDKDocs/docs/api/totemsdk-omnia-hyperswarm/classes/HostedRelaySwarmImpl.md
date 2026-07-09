[**@totemsdk/omnia-hyperswarm**](../index.md)

***

[@totemsdk/omnia-hyperswarm](../index.md) / HostedRelaySwarmImpl

# Class: HostedRelaySwarmImpl

## Implements

- [`OmniaSwarm`](../interfaces/OmniaSwarm.md)

## Constructors

### Constructor

> **new HostedRelaySwarmImpl**(`_relayUrl`, `_config?`): `HostedRelaySwarmImpl`

#### Parameters

##### \_relayUrl

`string`

##### \_config?

[`OmniaSwarmConfig`](../interfaces/OmniaSwarmConfig.md) = `{}`

#### Returns

`HostedRelaySwarmImpl`

## Methods

### advertise()

> **advertise**(`localPubkey`): `void`

Advertise this node so remote peers can reach us.

Subscribes to peerTopic(localPubkey) on the relay. All inbound messages on
that topic include env.from = senderPubkey and are routed to per-sender streams
in _onRelayMessage(). No further per-peer subscriptions are needed for inbound.

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

Send a message to all peers currently subscribed to `topic`.
`topic` is an arbitrary string; the Hyperswarm key is SHA3-256('omnia:' + topic).

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

Connect to a remote peer.

Also ensures we're subscribed to our own inbound topic (peerTopic(localPubkey))
so the remote can reply. Creates the peer lazily on first send.

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

In the relay model, inbound peers are discovered dynamically via _onRelayMessage
when they publish to peerTopic(ourPubkey). All peer entries (existing and newly
created) forward CHANNEL_PROPOSAL to the callbacks registered here.

Note: advertise() must be called to subscribe our inbound topic on the relay.

#### Parameters

##### onProposal

(`peer`, `proposal`) => `void`

#### Returns

[`Unsubscribe`](../type-aliases/Unsubscribe.md)

#### Implementation of

[`OmniaSwarm`](../interfaces/OmniaSwarm.md).[`listenForChannels`](../interfaces/OmniaSwarm.md#listenforchannels)
