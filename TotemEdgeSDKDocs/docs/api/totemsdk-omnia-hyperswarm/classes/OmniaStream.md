[**@totemsdk/omnia-hyperswarm**](../index.md)

***

[@totemsdk/omnia-hyperswarm](../index.md) / OmniaStream

# Class: OmniaStream

## Constructors

### Constructor

> **new OmniaStream**(`_stream`): `OmniaStream`

#### Parameters

##### \_stream

[`IDuplexStream`](../interfaces/IDuplexStream.md)

#### Returns

`OmniaStream`

## Methods

### destroy()

> **destroy**(): `void`

Destroy the underlying stream.

#### Returns

`void`

***

### onClose()

> **onClose**(`cb`): `void`

Subscribe to stream close events.

#### Parameters

##### cb

() => `void`

#### Returns

`void`

***

### onError()

> **onError**(`cb`): `void`

Subscribe to stream error events.

#### Parameters

##### cb

(`err`) => `void`

#### Returns

`void`

***

### onMessage()

> **onMessage**(`cb`): [`Unsubscribe`](../type-aliases/Unsubscribe.md)

Subscribe to incoming decoded messages. Returns an unsubscribe function.

#### Parameters

##### cb

(`msg`) => `void`

#### Returns

[`Unsubscribe`](../type-aliases/Unsubscribe.md)

***

### reset()

> **reset**(): `void`

Reset the frame parser (call after reconnect to drop any partial frame).

#### Returns

`void`

***

### send()

> **send**(`msg`): `void`

Encode and write a message to the underlying stream.
BigInt values in the payload are preserved via the __bigint sentinel.

#### Parameters

##### msg

[`OmniaMessage`](../interfaces/OmniaMessage.md)

#### Returns

`void`
