[**@totemsdk/omnia-host**](../index.md)

***

[@totemsdk/omnia-host](../index.md) / DuckDbAnalyticsStore

# Class: DuckDbAnalyticsStore

## Implements

- [`AnalyticsStore`](../interfaces/AnalyticsStore.md)

## Constructors

### Constructor

> **new DuckDbAnalyticsStore**(`db`): `DuckDbAnalyticsStore`

#### Parameters

##### db

[`DuckDbConnection`](../interfaces/DuckDbConnection.md)

#### Returns

`DuckDbAnalyticsStore`

## Methods

### append()

> **append**(`event`): `Promise`\<`void`\>

#### Parameters

##### event

[`AnalyticsEvent`](../interfaces/AnalyticsEvent.md)

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`AnalyticsStore`](../interfaces/AnalyticsStore.md).[`append`](../interfaces/AnalyticsStore.md#append)

***

### close()

> **close**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`AnalyticsStore`](../interfaces/AnalyticsStore.md).[`close`](../interfaces/AnalyticsStore.md#close)

***

### query()

> **query**(`kind?`, `limit?`): `Promise`\<[`AnalyticsEvent`](../interfaces/AnalyticsEvent.md)[]\>

#### Parameters

##### kind?

`string`

##### limit?

`number` = `100`

#### Returns

`Promise`\<[`AnalyticsEvent`](../interfaces/AnalyticsEvent.md)[]\>

#### Implementation of

[`AnalyticsStore`](../interfaces/AnalyticsStore.md).[`query`](../interfaces/AnalyticsStore.md#query)
