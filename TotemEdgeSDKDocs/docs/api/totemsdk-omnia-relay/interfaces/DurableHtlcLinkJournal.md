[**@totemsdk/omnia-relay**](../index.md)

***

[@totemsdk/omnia-relay](../index.md) / DurableHtlcLinkJournal

# Interface: DurableHtlcLinkJournal

## Extends

- [`HtlcLinkJournal`](HtlcLinkJournal.md)

## Methods

### get()

> **get**(`hashlock`): [`HtlcLink`](HtlcLink.md) \| `Promise`\<[`HtlcLink`](HtlcLink.md) \| `undefined`\> \| `undefined`

#### Parameters

##### hashlock

`string`

#### Returns

[`HtlcLink`](HtlcLink.md) \| `Promise`\<[`HtlcLink`](HtlcLink.md) \| `undefined`\> \| `undefined`

#### Inherited from

[`HtlcLinkJournal`](HtlcLinkJournal.md).[`get`](HtlcLinkJournal.md#get)

***

### getByIncoming()?

> `optional` **getByIncoming**(`params`): [`HtlcLink`](HtlcLink.md) \| `Promise`\<[`HtlcLink`](HtlcLink.md) \| `undefined`\> \| `undefined`

Optional durable lookup by the incoming HTLC (replay detection).

#### Parameters

##### params

###### inChannelId

`string`

###### inHtlcId

`string`

#### Returns

[`HtlcLink`](HtlcLink.md) \| `Promise`\<[`HtlcLink`](HtlcLink.md) \| `undefined`\> \| `undefined`

#### Inherited from

[`HtlcLinkJournal`](HtlcLinkJournal.md).[`getByIncoming`](HtlcLinkJournal.md#getbyincoming)

***

### list()

> **list**(): `Promise`\<[`HtlcLink`](HtlcLink.md)[]\>

Every link still awaiting a backwards settlement (for restart recovery).

#### Returns

`Promise`\<[`HtlcLink`](HtlcLink.md)[]\>

#### Overrides

[`HtlcLinkJournal`](HtlcLinkJournal.md).[`list`](HtlcLinkJournal.md#list)

***

### record()

> **record**(`link`): `void` \| `Promise`\<`void`\>

#### Parameters

##### link

[`HtlcLink`](HtlcLink.md)

#### Returns

`void` \| `Promise`\<`void`\>

#### Inherited from

[`HtlcLinkJournal`](HtlcLinkJournal.md).[`record`](HtlcLinkJournal.md#record)

***

### remove()

> **remove**(`hashlock`): `void` \| `Promise`\<`void`\>

#### Parameters

##### hashlock

`string`

#### Returns

`void` \| `Promise`\<`void`\>

#### Inherited from

[`HtlcLinkJournal`](HtlcLinkJournal.md).[`remove`](HtlcLinkJournal.md#remove)

***

### reserve()?

> `optional` **reserve**(`link`): [`ForwardReservation`](../type-aliases/ForwardReservation.md) \| `Promise`\<[`ForwardReservation`](../type-aliases/ForwardReservation.md)\>

Atomically check uniqueness and write the intent. A journal that offers
this makes forwarding admission atomic; without it the forwarder falls back
to check-then-record, which races under concurrency.

#### Parameters

##### link

[`HtlcLink`](HtlcLink.md)

#### Returns

[`ForwardReservation`](../type-aliases/ForwardReservation.md) \| `Promise`\<[`ForwardReservation`](../type-aliases/ForwardReservation.md)\>

#### Inherited from

[`HtlcLinkJournal`](HtlcLinkJournal.md).[`reserve`](HtlcLinkJournal.md#reserve)
