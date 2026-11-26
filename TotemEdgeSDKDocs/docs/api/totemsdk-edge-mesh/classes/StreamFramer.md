[**@totemsdk/edge-mesh**](../index.md)

***

[@totemsdk/edge-mesh](../index.md) / StreamFramer

# Class: StreamFramer

## Constructors

### Constructor

> **new StreamFramer**(): `StreamFramer`

#### Returns

`StreamFramer`

## Accessors

### buffered

#### Get Signature

> **get** **buffered**(): `number`

##### Returns

`number`

## Methods

### next()

> **next**(): `Uint8Array`\<`ArrayBufferLike`\> \| `undefined`

The whole frame including its 4-byte prefix, or undefined when short.

#### Returns

`Uint8Array`\<`ArrayBufferLike`\> \| `undefined`

***

### push()

> **push**(`data`): `void`

#### Parameters

##### data

`Uint8Array`

#### Returns

`void`
