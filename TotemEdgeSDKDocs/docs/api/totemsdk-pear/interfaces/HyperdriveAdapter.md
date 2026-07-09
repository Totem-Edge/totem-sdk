[**@totemsdk/pear**](../index.md)

***

[@totemsdk/pear](../index.md) / HyperdriveAdapter

# Interface: HyperdriveAdapter

@totemsdk/pear — Hyperdrive adapter + manifest loading

`HyperdriveAdapter` is the interface Totem marketplace code uses to read
app bundles from a Pear topic key. `BareHyperdriveAdapter` wraps a real
Hyperdrive instance. `loadManifest` reads `manifest.json` from a remote
Hyperdrive identified by its 64-hex `pearTopicKey` public key.

How remote drive access works:
  1. A Hyperswarm instance joins the topic derived from `pearTopicKey`.
  2. Incoming connections are plumbed into a Corestore replication stream.
  3. Hyperdrive is opened from the Corestore with the topic key as its
     root core public key — it replicates lazily from swarm peers.
  4. After the drive is `ready` the caller can read files normally.

Bare-compatible: no `process.env`, no `__dirname`, no `require`.
All Holepunch packages (hyperswarm, hyperdrive, corestore) are loaded via
dynamic import so the module is importable in environments where they are
absent (error surfaces lazily, only when the drive is first opened).

## Methods

### list()

> **list**(`path?`): `Promise`\<`string`[]\>

List files under a prefix path.

#### Parameters

##### path?

`string`

— directory prefix (default: '/')

#### Returns

`Promise`\<`string`[]\>

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
