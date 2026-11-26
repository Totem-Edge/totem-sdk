[**@totemsdk/edge-mesh**](../index.md)

***

[@totemsdk/edge-mesh](../index.md) / StoreAndForward

# Class: StoreAndForward

## Constructors

### Constructor

> **new StoreAndForward**(`maxBytes`, `maxHops`, `ttlMs`): `StoreAndForward`

#### Parameters

##### maxBytes

`number`

##### maxHops

`number`

##### ttlMs

`number`

#### Returns

`StoreAndForward`

## Accessors

### bytes

#### Get Signature

> **get** **bytes**(): `number`

##### Returns

`number`

***

### count

#### Get Signature

> **get** **count**(): `number`

##### Returns

`number`

***

### maxHops

#### Get Signature

> **get** **maxHops**(): `number`

##### Returns

`number`

***

### ttlMs

#### Get Signature

> **get** **ttlMs**(): `number`

##### Returns

`number`

## Methods

### add()

> **add**(`frame`, `hops`, `nowMs`): `boolean`

False when the frame is a duplicate, expired-or-seen, or too large.

#### Parameters

##### frame

`Uint8Array`

##### hops

`number`

##### nowMs

`number`

#### Returns

`boolean`

***

### seen()

> **seen**(`frame`, `nowMs`): `boolean`

#### Parameters

##### frame

`Uint8Array`

##### nowMs

`number`

#### Returns

`boolean`

***

### take()

> **take**(`nowMs`): [`RelayedFrame`](../interfaces/RelayedFrame.md)[]

Frames to transmit now; the queue is emptied, the dedupe cache is kept.

#### Parameters

##### nowMs

`number`

#### Returns

[`RelayedFrame`](../interfaces/RelayedFrame.md)[]
