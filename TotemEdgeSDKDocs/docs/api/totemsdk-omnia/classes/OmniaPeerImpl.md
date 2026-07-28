[**@totemsdk/omnia**](../index.md)

***

[@totemsdk/omnia](../index.md) / OmniaPeerImpl

# Class: OmniaPeerImpl

## Implements

- [`OmniaPeer`](../interfaces/OmniaPeer.md)

## Constructors

### Constructor

> **new OmniaPeerImpl**(`stream`, `opts`): `OmniaPeerImpl`

#### Parameters

##### stream

`IStreamTransport`

##### opts

[`OmniaPeerOptions`](../interfaces/OmniaPeerOptions.md)

#### Returns

`OmniaPeerImpl`

## Properties

### channelId

> `readonly` **channelId**: `string` \| `undefined`

#### Implementation of

[`OmniaPeer`](../interfaces/OmniaPeer.md).[`channelId`](../interfaces/OmniaPeer.md#channelid)

***

### pubkey

> `readonly` **pubkey**: `string`

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

#### Parameters

##### raw

`IStreamTransport`

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
