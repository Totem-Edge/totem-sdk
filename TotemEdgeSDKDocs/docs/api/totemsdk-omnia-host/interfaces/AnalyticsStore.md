[**@totemsdk/omnia-host**](../index.md)

***

[@totemsdk/omnia-host](../index.md) / AnalyticsStore

# Interface: AnalyticsStore

## Methods

### append()

> **append**(`event`): `Promise`\<`void`\>

#### Parameters

##### event

[`AnalyticsEvent`](AnalyticsEvent.md)

#### Returns

`Promise`\<`void`\>

***

### close()

> **close**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>

***

### query()

> **query**(`kind?`, `limit?`): `Promise`\<[`AnalyticsEvent`](AnalyticsEvent.md)[]\>

#### Parameters

##### kind?

`string`

##### limit?

`number`

#### Returns

`Promise`\<[`AnalyticsEvent`](AnalyticsEvent.md)[]\>
