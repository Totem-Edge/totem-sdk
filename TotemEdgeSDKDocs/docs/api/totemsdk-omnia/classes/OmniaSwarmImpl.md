[**@totemsdk/omnia**](../index.md)

***

[@totemsdk/omnia](../index.md) / OmniaSwarmImpl

# Class: OmniaSwarmImpl

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
