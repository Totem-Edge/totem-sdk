[**@totemsdk/server**](../index.md)

***

[@totemsdk/server](../index.md) / FileStorageAdapterOptions

# Interface: FileStorageAdapterOptions

## Properties

### directory

> **directory**: `string`

***

### failurePolicy?

> `optional` **failurePolicy?**: `"strict"` \| `"lenient"`

`strict` (default) surfaces `corrupt` records; `lenient` returns null.

***

### prefix?

> `optional` **prefix?**: `string`
