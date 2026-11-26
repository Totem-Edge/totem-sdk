[**@totemsdk/edge-ble**](../index.md)

***

[@totemsdk/edge-ble](../index.md) / BleMeshLink

# Class: BleMeshLink

## Implements

- `MeshLink`

## Constructors

### Constructor

> **new BleMeshLink**(`config`): `BleMeshLink`

#### Parameters

##### config

[`BleMeshLinkConfig`](../interfaces/BleMeshLinkConfig.md)

#### Returns

`BleMeshLink`

## Properties

### mtu

> `readonly` **mtu**: `number`

#### Implementation of

`MeshLink.mtu`

## Accessors

### lastError

#### Get Signature

> **get** **lastError**(): `string` \| `undefined`

##### Returns

`string` \| `undefined`

***

### pendingWrites

#### Get Signature

> **get** **pendingWrites**(): `number`

##### Returns

`number`

## Methods

### close()

> **close**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>

***

### flush()

> **flush**(): `Promise`\<`void`\>

Resolves when every queued packet has been written (tests, flush points).

#### Returns

`Promise`\<`void`\>

***

### open()

> **open**(): `Promise`\<`void`\>

Subscribe to the peer's TX characteristic.

#### Returns

`Promise`\<`void`\>

***

### receive()

> **receive**(): `Uint8Array`\<`ArrayBufferLike`\> \| `undefined`

#### Returns

`Uint8Array`\<`ArrayBufferLike`\> \| `undefined`

#### Implementation of

`MeshLink.receive`

***

### send()

> **send**(`packet`): `void`

#### Parameters

##### packet

`Uint8Array`

#### Returns

`void`

#### Implementation of

`MeshLink.send`
