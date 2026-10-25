[**@totemsdk/omnia-pool**](../index.md)

***

[@totemsdk/omnia-pool](../index.md) / RouterExecutionPort

# Interface: RouterExecutionPort

Minimal port wrapping live router operations.

## Methods

### addChannel()

> **addChannel**(`graph`, `edge`): `void`

#### Parameters

##### graph

`ChannelGraph`

##### edge

`ChannelGraphEdge`

#### Returns

`void`

***

### createChannelGraph()

> **createChannelGraph**(): `ChannelGraph`

#### Returns

`ChannelGraph`

***

### executeMultiHopPayment()

> **executeMultiHopPayment**(`ops`, `channels`, `route`, `paymentRequest`, `leaseProviders`): `Promise`\<`PaymentResult`\>

#### Parameters

##### ops

`ChannelOps`

##### channels

`Map`\<`string`, `RouterChannel`\>

##### route

`Route`

##### paymentRequest

`PaymentRequest`

##### leaseProviders

`Map`\<`string`, `unknown`\>

#### Returns

`Promise`\<`PaymentResult`\>

***

### findRoute()

> **findRoute**(`graph`, `from`, `to`, `amount`, `tokenId`, `opts?`): `Route` \| `undefined`

#### Parameters

##### graph

`ChannelGraph`

##### from

`string`

##### to

`string`

##### amount

`bigint`

##### tokenId

`string`

##### opts?

`RouteOptions`

#### Returns

`Route` \| `undefined`
