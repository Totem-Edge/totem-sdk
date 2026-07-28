[**@totemsdk/omnia**](../index.md)

***

[@totemsdk/omnia](../index.md) / OmniaPeer

# Interface: OmniaPeer

## Properties

### channelId

> `readonly` **channelId**: `string` \| `undefined`

***

### pubkey

> `readonly` **pubkey**: `string`

## Methods

### disconnect()

> **disconnect**(): `void`

#### Returns

`void`

***

### onMessage()

> **onMessage**(`cb`): [`Unsubscribe`](../type-aliases/Unsubscribe.md)

#### Parameters

##### cb

(`msg`) => `void`

#### Returns

[`Unsubscribe`](../type-aliases/Unsubscribe.md)

***

### onReconnected()

> **onReconnected**(`cb`): [`Unsubscribe`](../type-aliases/Unsubscribe.md)

#### Parameters

##### cb

() => `void`

#### Returns

[`Unsubscribe`](../type-aliases/Unsubscribe.md)

***

### onReconnecting()

> **onReconnecting**(`cb`): [`Unsubscribe`](../type-aliases/Unsubscribe.md)

#### Parameters

##### cb

(`attempt`) => `void`

#### Returns

[`Unsubscribe`](../type-aliases/Unsubscribe.md)

***

### sendMessage()

> **sendMessage**(`msg`): `Promise`\<`void`\>

#### Parameters

##### msg

[`OmniaMessage`](OmniaMessage.md)

#### Returns

`Promise`\<`void`\>
