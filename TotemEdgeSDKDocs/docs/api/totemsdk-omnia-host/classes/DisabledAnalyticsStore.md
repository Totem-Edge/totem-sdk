[**@totemsdk/omnia-host**](../index.md)

***

[@totemsdk/omnia-host](../index.md) / DisabledAnalyticsStore

# Class: DisabledAnalyticsStore

No-op analytics backend for phase 9 deployments without DuckDB enabled.
The interface keeps analytics off the channel critical path.

## Implements

- [`AnalyticsStore`](../interfaces/AnalyticsStore.md)

## Constructors

### Constructor

> **new DisabledAnalyticsStore**(): `DisabledAnalyticsStore`

#### Returns

`DisabledAnalyticsStore`

## Methods

### append()

> **append**(`_event`): `Promise`\<`void`\>

#### Parameters

##### \_event

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

> **query**(`_kind?`, `_limit?`): `Promise`\<[`AnalyticsEvent`](../interfaces/AnalyticsEvent.md)[]\>

#### Parameters

##### \_kind?

`string`

##### \_limit?

`number`

#### Returns

`Promise`\<[`AnalyticsEvent`](../interfaces/AnalyticsEvent.md)[]\>

#### Implementation of

[`AnalyticsStore`](../interfaces/AnalyticsStore.md).[`query`](../interfaces/AnalyticsStore.md#query)
