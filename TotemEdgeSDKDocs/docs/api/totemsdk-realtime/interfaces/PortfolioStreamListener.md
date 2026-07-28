[**@totemsdk/realtime**](../index.md)

***

[@totemsdk/realtime](../index.md) / PortfolioStreamListener

# Interface: PortfolioStreamListener

## Properties

### onConnectionStateChange?

> `optional` **onConnectionStateChange?**: (`state`, `error?`) => `void`

#### Parameters

##### state

[`ConnectionState`](../type-aliases/ConnectionState.md)

##### error?

`string`

#### Returns

`void`

***

### onTxConfirmation?

> `optional` **onTxConfirmation?**: (`event`) => `void`

#### Parameters

##### event

[`TxConfirmationEvent`](TxConfirmationEvent.md)

#### Returns

`void`

## Methods

### onPortfolioUpdate()

> **onPortfolioUpdate**(`event`): `void`

#### Parameters

##### event

[`PortfolioUpdateEvent`](PortfolioUpdateEvent.md)

#### Returns

`void`
