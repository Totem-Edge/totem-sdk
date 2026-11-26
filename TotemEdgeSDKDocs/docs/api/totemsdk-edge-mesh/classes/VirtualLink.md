[**@totemsdk/edge-mesh**](../index.md)

***

[@totemsdk/edge-mesh](../index.md) / VirtualLink

# Class: VirtualLink

## Implements

- [`MeshLink`](../interfaces/MeshLink.md)

## Constructors

### Constructor

> **new VirtualLink**(`mtu?`): `VirtualLink`

#### Parameters

##### mtu?

`number` = `185`

#### Returns

`VirtualLink`

## Properties

### mtu

> `readonly` **mtu**: `number`

#### Implementation of

[`MeshLink`](../interfaces/MeshLink.md).[`mtu`](../interfaces/MeshLink.md#mtu)

## Accessors

### droppedCount

#### Get Signature

> **get** **droppedCount**(): `number`

##### Returns

`number`

## Methods

### corruptNextPacket()

> **corruptNextPacket**(): `void`

#### Returns

`void`

***

### dropNextPacket()

> **dropNextPacket**(): `void`

#### Returns

`void`

***

### receive()

> **receive**(): `Uint8Array`\<`ArrayBufferLike`\> \| `undefined`

#### Returns

`Uint8Array`\<`ArrayBufferLike`\> \| `undefined`

#### Implementation of

[`MeshLink`](../interfaces/MeshLink.md).[`receive`](../interfaces/MeshLink.md#receive)

***

### send()

> **send**(`packet`): `void`

#### Parameters

##### packet

`Uint8Array`

#### Returns

`void`

#### Implementation of

[`MeshLink`](../interfaces/MeshLink.md).[`send`](../interfaces/MeshLink.md#send)
