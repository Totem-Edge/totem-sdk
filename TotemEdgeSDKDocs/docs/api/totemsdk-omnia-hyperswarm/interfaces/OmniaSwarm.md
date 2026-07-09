[**@totemsdk/omnia-hyperswarm**](../index.md)

***

[@totemsdk/omnia-hyperswarm](../index.md) / OmniaSwarm

# Interface: OmniaSwarm

## Methods

### advertise()

> **advertise**(`localPubkey`): `void`

Advertise this node on the peer-discovery topic derived from `localPubkey`
so remote nodes can connect to us via `connectToPeer(localPubkey)`.

Derived topic: SHA3-256('omnia:peer:' + localPubkey).
Safe to call multiple times — subsequent calls for the same pubkey are no-ops.

#### Parameters

##### localPubkey

`string`

#### Returns

`void`

***

### broadcast()

> **broadcast**(`topic`, `msg`): `Promise`\<`void`\>

Send a message to all peers currently subscribed to `topic`.
`topic` is an arbitrary string; the Hyperswarm key is SHA3-256('omnia:' + topic).

#### Parameters

##### topic

`string`

##### msg

[`OmniaMessage`](OmniaMessage.md)

#### Returns

`Promise`\<`void`\>

***

### close()

> **close**(): `Promise`\<`void`\>

Gracefully shut down the swarm, disconnecting all peers.

#### Returns

`Promise`\<`void`\>

***

### connectToPeer()

> **connectToPeer**(`pubkey`, `channelId?`): `Promise`\<[`OmniaPeer`](OmniaPeer.md)\>

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

`Promise`\<[`OmniaPeer`](OmniaPeer.md)\>

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
