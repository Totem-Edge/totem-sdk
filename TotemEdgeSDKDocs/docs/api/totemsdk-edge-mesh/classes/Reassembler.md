[**@totemsdk/edge-mesh**](../index.md)

***

[@totemsdk/edge-mesh](../index.md) / Reassembler

# Class: Reassembler

## Constructors

### Constructor

> **new Reassembler**(`options?`): `Reassembler`

`onReject` observes every dropped packet with a reason. Dropping is still
the wire behaviour (a relay must not throw on hostile input); this makes it
countable instead of silent.

#### Parameters

##### options?

###### onReject?

[`MeshRejectSink`](../type-aliases/MeshRejectSink.md)

#### Returns

`Reassembler`

## Accessors

### pending

#### Get Signature

> **get** **pending**(): `number`

##### Returns

`number`

## Methods

### add()

> **add**(`packet`, `nowMs`): [`AssembledFrame`](../interfaces/AssembledFrame.md) \| `undefined`

#### Parameters

##### packet

`Uint8Array`

##### nowMs

`number`

#### Returns

[`AssembledFrame`](../interfaces/AssembledFrame.md) \| `undefined`

***

### expire()

> **expire**(`nowMs`, `ttlMs`): `void`

#### Parameters

##### nowMs

`number`

##### ttlMs

`number`

#### Returns

`void`
