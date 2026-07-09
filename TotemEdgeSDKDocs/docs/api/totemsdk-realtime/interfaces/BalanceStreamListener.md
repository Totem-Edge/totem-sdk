[**@totemsdk/realtime**](../index.md)

***

[@totemsdk/realtime](../index.md) / BalanceStreamListener

# Interface: BalanceStreamListener

## Properties

### onBalanceUpdate

> **onBalanceUpdate**: (`event`) => `void`

#### Parameters

##### event

[`BalanceUpdateEvent`](BalanceUpdateEvent.md)

#### Returns

`void`

***

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
