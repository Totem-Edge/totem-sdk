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

### detach()

> **detach**(): `void`

Stop delivering data to listeners and drop them, without closing the
underlying transport. Used when a peer rebinds to a newer connection: the
superseded socket stays owned by hyperswarm (which destroys the loser),
but must not keep feeding frames to the peer.

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
