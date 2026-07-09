[**@totemsdk/omnia-hyperswarm**](../index.md)

***

[@totemsdk/omnia-hyperswarm](../index.md) / IDuplexStream

# Interface: IDuplexStream

## Methods

### destroy()

> **destroy**(`err?`): `void`

#### Parameters

##### err?

`Error`

#### Returns

`void`

***

### on()

#### Call Signature

> **on**(`event`, `cb`): `this`

##### Parameters

###### event

`"data"`

###### cb

(`chunk`) => `void`

##### Returns

`this`

#### Call Signature

> **on**(`event`, `cb`): `this`

##### Parameters

###### event

`"close"`

###### cb

() => `void`

##### Returns

`this`

#### Call Signature

> **on**(`event`, `cb`): `this`

##### Parameters

###### event

`"error"`

###### cb

(`err`) => `void`

##### Returns

`this`

***

### write()

> **write**(`data`): `void`

#### Parameters

##### data

`Buffer`\<`ArrayBufferLike`\> \| `Uint8Array`\<`ArrayBufferLike`\>

#### Returns

`void`
