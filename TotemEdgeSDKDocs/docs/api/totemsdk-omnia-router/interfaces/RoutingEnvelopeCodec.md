[**@totemsdk/omnia-router**](../index.md)

***

[@totemsdk/omnia-router](../index.md) / RoutingEnvelopeCodec

# Interface: RoutingEnvelopeCodec

## Methods

### build()

> **build**(`hops`): `string`

Sender: build the envelope from the onward hops (already excludes the first hop).

#### Parameters

##### hops

([`RoutingHop`](RoutingHop.md) \| [`SwapHop`](SwapHop.md))[]

#### Returns

`string`

***

### peel()

> **peel**(`envelope`, `self`): [`PeelResult`](../type-aliases/PeelResult.md)

Forwarder: peel one hop for `self`.

#### Parameters

##### envelope

`string`

##### self

###### publicKeyDigest

`string`

#### Returns

[`PeelResult`](../type-aliases/PeelResult.md)
