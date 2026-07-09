[**@totemsdk/lookup-node**](../index.md)

***

[@totemsdk/lookup-node](../index.md) / TrustIndex

# Class: TrustIndex

## Constructors

### Constructor

> **new TrustIndex**(`store`, `config?`): `TrustIndex`

#### Parameters

##### store

[`SqliteStore`](SqliteStore.md)

SQLite backing store

##### config?

[`TrustIndexConfig`](../interfaces/TrustIndexConfig.md)

Trust index configuration

#### Returns

`TrustIndex`

## Methods

### query()

> **query**(`msg`, `sendFn`): `void`

#### Parameters

##### msg

`TrustQueryMessage`

##### sendFn

`SendFn`

#### Returns

`void`

***

### record()

> **record**(`msg`): `void`

#### Parameters

##### msg

`TrustRecordMessage`

#### Returns

`void`
