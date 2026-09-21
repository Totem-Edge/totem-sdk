[**@totemsdk/omnia-pool**](../index.md)

***

[@totemsdk/omnia-pool](../index.md) / RouterExecutionPort

# Interface: RouterExecutionPort

Minimal port wrapping live router operations.

## Methods

### addChannel()

> **addChannel**(`graph`, `channel`): `ChannelGraph`

#### Parameters

##### graph

`ChannelGraph`

##### channel

`RouterChannel`

#### Returns

`ChannelGraph`

***

### createChannelGraph()

> **createChannelGraph**(): `ChannelGraph`

#### Returns

`ChannelGraph`

***

### executeMultiHopPayment()

> **executeMultiHopPayment**(`graph`, `route`, `channelOps`): `Promise`\<`PaymentResult`\>

#### Parameters

##### graph

`ChannelGraph`

##### route

`Route`

##### channelOps

`ChannelOps`

#### Returns

`Promise`\<`PaymentResult`\>

***

### findRoute()

> **findRoute**(`graph`, `request`): `Route` \| `undefined`

#### Parameters

##### graph

`ChannelGraph`

##### request

`PaymentRequest`

#### Returns

`Route` \| `undefined`
