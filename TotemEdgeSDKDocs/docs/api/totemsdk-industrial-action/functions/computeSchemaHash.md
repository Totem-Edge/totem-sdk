[**@totemsdk/industrial-action**](../index.md)

***

[@totemsdk/industrial-action](../index.md) / computeSchemaHash

# Function: computeSchemaHash()

> **computeSchemaHash**(`schema`): `string`

Canonical hash of a schema's structural fields (names, types, required flags,
quantity constraints). `validation` callbacks and `defaultValue`s are not
part of the schema contract and are excluded.

## Parameters

### schema

[`ActionSchema`](../interfaces/ActionSchema.md)

## Returns

`string`
