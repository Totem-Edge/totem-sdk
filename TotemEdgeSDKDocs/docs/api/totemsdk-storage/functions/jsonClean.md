[**@totemsdk/storage**](../index.md)

***

[@totemsdk/storage](../index.md) / jsonClean

# Function: jsonClean()

> **jsonClean**(`value`): `unknown`

Persistable values are JSON-clean by contract (the codec rejects bare
`undefined` rather than silently dropping it): object keys with undefined
values are removed and undefined array entries become `null`, matching
`JSON.stringify` semantics while preserving bigint and Uint8Array values.

## Parameters

### value

`unknown`

## Returns

`unknown`
