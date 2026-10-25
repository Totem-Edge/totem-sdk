[**@totemsdk/omnia**](../index.md)

***

[@totemsdk/omnia](../index.md) / OmniaCoordination

# Interface: OmniaCoordination

## Properties

### policy

> `readonly` **policy**: `Required`\<[`CoordinationPolicy`](CoordinationPolicy.md)\>

***

### store

> `readonly` **store**: [`CoordinationStore`](CoordinationStore.md)

## Methods

### bindPeer()

> **bindPeer**(`peer`): () => `void`

Route a peer's inbound coordination messages to the registered handlers.

#### Parameters

##### peer

[`OmniaPeer`](OmniaPeer.md)

#### Returns

() => `void`

***

### send()

> **send**(`peer`, `type`, `channelId`, `correlationId`, `payload`): `Promise`\<`void`\>

Send a coordination message on a peer.

#### Parameters

##### peer

[`OmniaPeer`](OmniaPeer.md)

##### type

[`OmniaMessageType`](../type-aliases/OmniaMessageType.md)

##### channelId

`string`

##### correlationId

`string`

##### payload

`unknown`

#### Returns

`Promise`\<`void`\>

***

### sendProposal()

> **sendProposal**(`params`): `Promise`\<[`OmniaMessage`](OmniaMessage.md)\>

Persist a proposal record and send the proposal message.

#### Parameters

##### params

[`SendProposalParams`](SendProposalParams.md)

#### Returns

`Promise`\<[`OmniaMessage`](OmniaMessage.md)\>
