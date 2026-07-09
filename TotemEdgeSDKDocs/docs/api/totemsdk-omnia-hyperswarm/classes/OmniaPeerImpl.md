[**@totemsdk/omnia-hyperswarm**](../index.md)

***

[@totemsdk/omnia-hyperswarm](../index.md) / OmniaPeerImpl

# Class: OmniaPeerImpl

## Implements

- [`OmniaPeer`](../interfaces/OmniaPeer.md)

## Constructors

### Constructor

> **new OmniaPeerImpl**(`stream`, `opts`): `OmniaPeerImpl`

#### Parameters

##### stream

[`IDuplexStream`](../interfaces/IDuplexStream.md)

##### opts

`OmniaPeerOptions`

#### Returns

`OmniaPeerImpl`

## Properties

### channelId

> `readonly` **channelId**: `string` \| `undefined`

Channel ID this peer is associated with, if known.

#### Implementation of

[`OmniaPeer`](../interfaces/OmniaPeer.md).[`channelId`](../interfaces/OmniaPeer.md#channelid)

***

### pubkey

> `readonly` **pubkey**: `string`

Hex-encoded 32-byte public key of the remote peer.

#### Implementation of

[`OmniaPeer`](../interfaces/OmniaPeer.md).[`pubkey`](../interfaces/OmniaPeer.md#pubkey)

## Methods

### disconnect()

> **disconnect**(): `void`

#### Returns

`void`

#### Implementation of

[`OmniaPeer`](../interfaces/OmniaPeer.md).[`disconnect`](../interfaces/OmniaPeer.md#disconnect)

***

### onMessage()

> **onMessage**(`cb`): [`Unsubscribe`](../type-aliases/Unsubscribe.md)

#### Parameters

##### cb

(`msg`) => `void`

#### Returns

[`Unsubscribe`](../type-aliases/Unsubscribe.md)

#### Implementation of

[`OmniaPeer`](../interfaces/OmniaPeer.md).[`onMessage`](../interfaces/OmniaPeer.md#onmessage)

***

### onReconnected()

> **onReconnected**(`cb`): [`Unsubscribe`](../type-aliases/Unsubscribe.md)

#### Parameters

##### cb

() => `void`

#### Returns

[`Unsubscribe`](../type-aliases/Unsubscribe.md)

#### Implementation of

[`OmniaPeer`](../interfaces/OmniaPeer.md).[`onReconnected`](../interfaces/OmniaPeer.md#onreconnected)

***

### onReconnecting()

> **onReconnecting**(`cb`): [`Unsubscribe`](../type-aliases/Unsubscribe.md)

#### Parameters

##### cb

(`attempt`) => `void`

#### Returns

[`Unsubscribe`](../type-aliases/Unsubscribe.md)

#### Implementation of

[`OmniaPeer`](../interfaces/OmniaPeer.md).[`onReconnecting`](../interfaces/OmniaPeer.md#onreconnecting)

***

### rebindStream()

> **rebindStream**(`raw`): `void`

Rebind this peer to a new stream (e.g. when the swarm receives a fresh
inbound connection from the same pubkey after reconnect or churn).

- Increments `_streamVersion` so any pending reconnect timer is suppressed.
- Destroys the old stream.
- Attaches the new stream — all existing onMessage/onReconnecting/onReconnected
  subscribers continue to work without re-subscribing.

#### Parameters

##### raw

[`IDuplexStream`](../interfaces/IDuplexStream.md)

#### Returns

`void`

***

### sendMessage()

> **sendMessage**(`msg`): `Promise`\<`void`\>

#### Parameters

##### msg

[`OmniaMessage`](../interfaces/OmniaMessage.md)

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`OmniaPeer`](../interfaces/OmniaPeer.md).[`sendMessage`](../interfaces/OmniaPeer.md#sendmessage)
