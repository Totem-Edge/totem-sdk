[**@totemsdk/pear**](../index.md)

***

[@totemsdk/pear](../index.md) / BareHyperdriveAdapter

# Class: BareHyperdriveAdapter

Wraps a real Hyperdrive instance (from the `hyperdrive` npm package) or
any duck-typed object as a `HyperdriveAdapter`.

Constructor accepts any Hyperdrive-like object so tests can inject mocks.

## Implements

- [`HyperdriveAdapter`](../interfaces/HyperdriveAdapter.md)

## Constructors

### Constructor

> **new BareHyperdriveAdapter**(`_drive`): `BareHyperdriveAdapter`

#### Parameters

##### \_drive

`any`

#### Returns

`BareHyperdriveAdapter`

## Methods

### list()

> **list**(`path?`): `Promise`\<`string`[]\>

List files under a prefix path.

#### Parameters

##### path?

`string` = `'/'`

— directory prefix (default: '/')

#### Returns

`Promise`\<`string`[]\>

#### Implementation of

[`HyperdriveAdapter`](../interfaces/HyperdriveAdapter.md).[`list`](../interfaces/HyperdriveAdapter.md#list)

***

### readFile()

> **readFile**(`path`): `Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

Read a file from the drive.

#### Parameters

##### path

`string`

— absolute path within the drive, e.g. `/manifest.json`

#### Returns

`Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

#### Implementation of

[`HyperdriveAdapter`](../interfaces/HyperdriveAdapter.md).[`readFile`](../interfaces/HyperdriveAdapter.md#readfile)

***

### watch()

> **watch**(`path`, `cb`): () => `void`

Watch a path for changes.

#### Parameters

##### path

`string`

##### cb

(`changedPath`) => `void`

#### Returns

Unsubscribe function

() => `void`

#### Implementation of

[`HyperdriveAdapter`](../interfaces/HyperdriveAdapter.md).[`watch`](../interfaces/HyperdriveAdapter.md#watch)

***

### writeFile()

> **writeFile**(`path`, `data`): `Promise`\<`void`\>

Write or overwrite a file in the drive.

#### Parameters

##### path

`string`

— absolute path within the drive

##### data

`Uint8Array`

— raw bytes to write

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`HyperdriveAdapter`](../interfaces/HyperdriveAdapter.md).[`writeFile`](../interfaces/HyperdriveAdapter.md#writefile)
