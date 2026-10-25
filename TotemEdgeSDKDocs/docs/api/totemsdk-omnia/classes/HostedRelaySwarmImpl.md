[**@totemsdk/omnia**](../index.md)

***

[@totemsdk/omnia](../index.md) / HostedRelaySwarmImpl

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

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`OmniaSwarm`](../interfaces/OmniaSwarm.md).[`close`](../interfaces/OmniaSwarm.md#close)

***

### connectToPeer()

> **connectToPeer**(`pubkey`, `channelId?`): `Promise`\<[`OmniaPeer`](../interfaces/OmniaPeer.md)\>

Connect to a peer by its Omnia participant pubkey (rendezvous topic).
`expectedTransportPubkey` is the peer's native transport identity (from
its signed manifest); native transports match it against the noise key.

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

#### Parameters

##### onProposal

(`peer`, `proposal`) => `void`

#### Returns

[`Unsubscribe`](../type-aliases/Unsubscribe.md)

#### Implementation of

[`OmniaSwarm`](../interfaces/OmniaSwarm.md).[`listenForChannels`](../interfaces/OmniaSwarm.md#listenforchannels)
