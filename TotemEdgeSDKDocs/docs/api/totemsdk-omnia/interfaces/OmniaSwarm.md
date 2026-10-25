[**@totemsdk/omnia**](../index.md)

***

[@totemsdk/omnia](../index.md) / OmniaSwarm

# Interface: OmniaSwarm

## Methods

### advertise()

> **advertise**(`localPubkey`): `void`

#### Parameters

##### localPubkey

`string`

#### Returns

`void`

***

### broadcast()

> **broadcast**(`topic`, `msg`): `Promise`\<`void`\>

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

#### Returns

`Promise`\<`void`\>

***

### connectToPeer()

> **connectToPeer**(`pubkey`, `channelId?`, `expectedTransportPubkey?`): `Promise`\<[`OmniaPeer`](OmniaPeer.md)\>

Connect to a peer by its Omnia participant pubkey (rendezvous topic).
`expectedTransportPubkey` is the peer's native transport identity (from
its signed manifest); native transports match it against the noise key.

#### Parameters

##### pubkey

`string`

##### channelId?

`string`

##### expectedTransportPubkey?

`string`

#### Returns

`Promise`\<[`OmniaPeer`](OmniaPeer.md)\>

***

### listenForChannels()

> **listenForChannels**(`onProposal`): [`Unsubscribe`](../type-aliases/Unsubscribe.md)

#### Parameters

##### onProposal

(`peer`, `proposal`) => `void`

#### Returns

[`Unsubscribe`](../type-aliases/Unsubscribe.md)

***

### nativeSwarm()?

> `optional` **nativeSwarm**(): `unknown`

Underlying transport instance (Hyperswarm/relay), for local bridges.

#### Returns

`unknown`
