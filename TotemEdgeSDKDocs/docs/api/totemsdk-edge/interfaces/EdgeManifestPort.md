[**@totemsdk/edge**](../index.md)

***

[@totemsdk/edge](../index.md) / EdgeManifestPort

# Interface: EdgeManifestPort

## Methods

### sign()

> **sign**(`manifest`, `seed`, `keyIndex`): `Promise`\<[`EdgeOperationResult`](EdgeOperationResult.md)\<\{ `signed`: `unknown`; \}\>\>

#### Parameters

##### manifest

`unknown`

##### seed

`Uint8Array`

##### keyIndex

`number`

#### Returns

`Promise`\<[`EdgeOperationResult`](EdgeOperationResult.md)\<\{ `signed`: `unknown`; \}\>\>

***

### verify()

> **verify**(`signed`): `Promise`\<[`EdgeOperationResult`](EdgeOperationResult.md)\<\{ `reason?`: `string`; `valid`: `boolean`; \}\>\>

#### Parameters

##### signed

`unknown`

#### Returns

`Promise`\<[`EdgeOperationResult`](EdgeOperationResult.md)\<\{ `reason?`: `string`; `valid`: `boolean`; \}\>\>
