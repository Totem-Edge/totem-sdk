[**@totemsdk/pear**](../index.md)

***

[@totemsdk/pear](../index.md) / BareFileStoreOptions

# Interface: BareFileStoreOptions

## Properties

### failurePolicy?

> `optional` **failurePolicy?**: `"strict"` \| `"lenient"`

`strict` (default) surfaces corrupt data; `lenient` treats it as empty.

***

### filePath

> **filePath**: `string`

Absolute path to the codec file backing this store.

***

### fs?

> `optional` **fs?**: [`FsLike`](FsLike.md)

Optional fs shim. Pass `bare-fs` inside a Bare/Pear app.
