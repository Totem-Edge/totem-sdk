[**@totemsdk/qvac**](../index.md)

***

[@totemsdk/qvac](../index.md) / QvacSdkLike

# Interface: QvacSdkLike

Structural QVAC SDK surface.

Consumers provide either the real `@qvac/sdk` module or a compatible mock.
`id`, `version`, and `plugins` are optional discovery hints; when absent the
provider falls back to defaults.

## Indexable

> \[`op`: `string`\]: `unknown`

Canonical op callables, keyed by op name (e.g. `completion`, `embed`,
`ragSearch`). The default handler resolves `sdk[op]` when present and
throws NOT_IMPLEMENTED otherwise.

## Properties

### id?

> `readonly` `optional` **id?**: `string`

***

### version?

> `readonly` `optional` **version?**: `string`

## Methods

### close()?

> `optional` **close**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>
