[**@totemsdk/edge**](../index.md)

***

[@totemsdk/edge](../index.md) / EdgeLookupPort

# Interface: EdgeLookupPort

## Methods

### announce()

> **announce**(`params`): `Promise`\<[`EdgeOperationResult`](EdgeOperationResult.md)\<`unknown`\>\>

#### Parameters

##### params

\{ `appId`: `string`; `authorAddress?`: `string`; `expiresAt`: `number`; `isFree?`: `boolean`; `kind`: `"app"`; `signed`: `unknown`; \} \| \{ `capabilityId`: `string`; `expiresAt`: `number`; `kind`: `"agent"`; `latencyMs?`: `number`; `pricePerCall?`: `number`; `signed`: `unknown`; `tags?`: `string`[]; \}

###### Type Literal

\{ `appId`: `string`; `authorAddress?`: `string`; `expiresAt`: `number`; `isFree?`: `boolean`; `kind`: `"app"`; `signed`: `unknown`; \}

###### appId

`string`

###### authorAddress?

`string`

###### expiresAt

`number`

###### isFree?

`boolean`

###### kind

`"app"`

###### signed

`unknown`

WOTS-signed manifest (SignedManifest from @totemsdk/manifest).

***

###### Type Literal

\{ `capabilityId`: `string`; `expiresAt`: `number`; `kind`: `"agent"`; `latencyMs?`: `number`; `pricePerCall?`: `number`; `signed`: `unknown`; `tags?`: `string`[]; \}

###### capabilityId

`string`

###### expiresAt

`number`

###### kind

`"agent"`

###### latencyMs?

`number`

###### pricePerCall?

`number`

###### signed

`unknown`

WOTS-signed manifest (SignedManifest from @totemsdk/manifest).

###### tags?

`string`[]

#### Returns

`Promise`\<[`EdgeOperationResult`](EdgeOperationResult.md)\<`unknown`\>\>

***

### lookup()

> **lookup**(`params`): `Promise`\<[`EdgeOperationResult`](EdgeOperationResult.md)\<\{ `results`: `unknown`[]; \}\>\>

#### Parameters

##### params

###### kind?

`string`

###### query

`string`

#### Returns

`Promise`\<[`EdgeOperationResult`](EdgeOperationResult.md)\<\{ `results`: `unknown`[]; \}\>\>

***

### query()

> **query**(`params`): `Promise`\<[`EdgeOperationResult`](EdgeOperationResult.md)\<\{ `results`: `object`[]; \}\>\>

Query the lookup network for registered apps or agents.
Returns an empty array if no lookup port is configured on the node.

#### Parameters

##### params

\{ `authorAddress?`: `string`; `category?`: `string`[]; `freeOnly?`: `boolean`; `kind`: `"app"`; `limit?`: `number`; `minVersion?`: `number`; \} \| \{ `capabilityName?`: `string`; `kind`: `"agent"`; `limit?`: `number`; `maxLatencyMs?`: `number`; `maxPricePerCall?`: `number`; `tags?`: `string`[]; \}

#### Returns

`Promise`\<[`EdgeOperationResult`](EdgeOperationResult.md)\<\{ `results`: `object`[]; \}\>\>

***

### watch()

> **watch**(`params`): `Promise`\<[`EdgeOperationResult`](EdgeOperationResult.md)\<\{ `unsubscribe`: () => `void`; \}\>\>

#### Parameters

##### params

###### address

`string`

###### onUpdate

(`data`) => `void`

#### Returns

`Promise`\<[`EdgeOperationResult`](EdgeOperationResult.md)\<\{ `unsubscribe`: () => `void`; \}\>\>
