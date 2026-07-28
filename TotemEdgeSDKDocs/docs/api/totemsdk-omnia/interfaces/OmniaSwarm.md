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

> **connectToPeer**(`pubkey`, `channelId?`): `Promise`\<[`OmniaPeer`](OmniaPeer.md)\>

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

#### Parameters

##### onProposal

(`peer`, `proposal`) => `void`

#### Returns

[`Unsubscribe`](../type-aliases/Unsubscribe.md)
