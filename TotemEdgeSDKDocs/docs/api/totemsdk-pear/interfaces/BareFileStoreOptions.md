[**@totemsdk/pear**](../index.md)

***

[@totemsdk/pear](../index.md) / BareFileStoreOptions

# Interface: BareFileStoreOptions

## Properties

### filePath

> **filePath**: `string`

Absolute path to the JSON file that backs this store.
The parent directory is created automatically if it does not exist.

***

### fs?

> `optional` **fs?**: [`FsLike`](FsLike.md)

Optional fs shim — defaults to `node:fs`.
Pass `bare-fs` here when running inside a Bare/Pear app.
