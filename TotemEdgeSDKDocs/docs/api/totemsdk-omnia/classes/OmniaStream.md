[**@totemsdk/omnia**](../index.md)

***

[@totemsdk/omnia](../index.md) / OmniaStream

# Class: OmniaStream

## Constructors

### Constructor

> **new OmniaStream**(`_stream`): `OmniaStream`

#### Parameters

##### \_stream

`IStreamTransport`

#### Returns

`OmniaStream`

## Methods

### destroy()

> **destroy**(): `void`

#### Returns

`void`

***

### onClose()

> **onClose**(`cb`): [`Unsubscribe`](../type-aliases/Unsubscribe.md)

#### Parameters

##### cb

() => `void`

#### Returns

[`Unsubscribe`](../type-aliases/Unsubscribe.md)

***

### onError()

> **onError**(`cb`): [`Unsubscribe`](../type-aliases/Unsubscribe.md)

#### Parameters

##### cb

(`err`) => `void`

#### Returns

[`Unsubscribe`](../type-aliases/Unsubscribe.md)

***

### onMessage()

> **onMessage**(`cb`): [`Unsubscribe`](../type-aliases/Unsubscribe.md)

#### Parameters

##### cb

(`msg`) => `void`

#### Returns

[`Unsubscribe`](../type-aliases/Unsubscribe.md)

***

### reset()

> **reset**(): `void`

#### Returns

`void`

***

### send()

> **send**(`msg`): `Promise`\<`void`\>

#### Parameters

##### msg

[`OmniaMessage`](../interfaces/OmniaMessage.md)

#### Returns

`Promise`\<`void`\>
