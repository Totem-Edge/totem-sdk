[**@totemsdk/omnia-relay**](../index.md)

***

[@totemsdk/omnia-relay](../index.md) / HtlcLinkJournal

# Interface: HtlcLinkJournal

## Extended by

- [`DurableHtlcLinkJournal`](DurableHtlcLinkJournal.md)

## Methods

### get()

> **get**(`hashlock`): [`HtlcLink`](HtlcLink.md) \| `Promise`\<[`HtlcLink`](HtlcLink.md) \| `undefined`\> \| `undefined`

#### Parameters

##### hashlock

`string`

#### Returns

[`HtlcLink`](HtlcLink.md) \| `Promise`\<[`HtlcLink`](HtlcLink.md) \| `undefined`\> \| `undefined`

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

***

### list()?

> `optional` **list**(): [`HtlcLink`](HtlcLink.md)[] \| `Promise`\<[`HtlcLink`](HtlcLink.md)[]\>

Optional recovery listing of every unresolved link.

#### Returns

[`HtlcLink`](HtlcLink.md)[] \| `Promise`\<[`HtlcLink`](HtlcLink.md)[]\>

***

### record()

> **record**(`link`): `void` \| `Promise`\<`void`\>

#### Parameters

##### link

[`HtlcLink`](HtlcLink.md)

#### Returns

`void` \| `Promise`\<`void`\>

***

### remove()

> **remove**(`hashlock`): `void` \| `Promise`\<`void`\>

#### Parameters

##### hashlock

`string`

#### Returns

`void` \| `Promise`\<`void`\>

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
