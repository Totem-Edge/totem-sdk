[**@totemsdk/edge-adapters**](../index.md)

***

[@totemsdk/edge-adapters](../index.md) / SQLiteCommerceStore

# Class: SQLiteCommerceStore

Aggregated durable commerce store.

## Implements

- [`CommerceStore`](../interfaces/CommerceStore.md)

## Constructors

### Constructor

> **new SQLiteCommerceStore**(`config`): `SQLiteCommerceStore`

#### Parameters

##### config

[`SQLiteCommerceStoreConfig`](../interfaces/SQLiteCommerceStoreConfig.md)

#### Returns

`SQLiteCommerceStore`

## Properties

### negotiations

> `readonly` **negotiations**: `NegotiationStore`

#### Implementation of

[`CommerceStore`](../interfaces/CommerceStore.md).[`negotiations`](../interfaces/CommerceStore.md#negotiations)

***

### outbox

> `readonly` **outbox**: `OutboxStore`

#### Implementation of

[`CommerceStore`](../interfaces/CommerceStore.md).[`outbox`](../interfaces/CommerceStore.md#outbox)

***

### principals

> `readonly` **principals**: `PrincipalNegotiationStore`

#### Implementation of

[`CommerceStore`](../interfaces/CommerceStore.md).[`principals`](../interfaces/CommerceStore.md#principals)

***

### purchases

> `readonly` **purchases**: `PurchaseStore`

#### Implementation of

[`CommerceStore`](../interfaces/CommerceStore.md).[`purchases`](../interfaces/CommerceStore.md#purchases)

***

### replay

> `readonly` **replay**: `ReplayLedger`

#### Implementation of

[`CommerceStore`](../interfaces/CommerceStore.md).[`replay`](../interfaces/CommerceStore.md#replay)

## Methods

### close()

> **close**(): `void`

#### Returns

`void`
