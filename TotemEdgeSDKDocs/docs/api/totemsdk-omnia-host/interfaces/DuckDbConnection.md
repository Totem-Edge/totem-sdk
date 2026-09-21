[**@totemsdk/omnia-host**](../index.md)

***

[@totemsdk/omnia-host](../index.md) / DuckDbConnection

# Interface: DuckDbConnection

Adapter boundary for the optional DuckDB implementation.

## Methods

### all()

> **all**\<`T`\>(`sql`, ...`params`): `Promise`\<`T`[]\>

#### Type Parameters

##### T

`T`

#### Parameters

##### sql

`string`

##### params

...`unknown`[]

#### Returns

`Promise`\<`T`[]\>

***

### close()

> **close**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>

***

### run()

> **run**(`sql`, ...`params`): `Promise`\<`void`\>

#### Parameters

##### sql

`string`

##### params

...`unknown`[]

#### Returns

`Promise`\<`void`\>
