[**@totemsdk/pear**](../index.md)

***

[@totemsdk/pear](../index.md) / RemoteDriveOptions

# Interface: RemoteDriveOptions

## Properties

### connectTimeoutMs?

> `optional` **connectTimeoutMs?**: `number`

How long to wait (ms) for at least one peer to join the topic before
giving up. Default: 20_000.

***

### storagePath?

> `optional` **storagePath?**: `string`

Corestore base directory for persisting replicated blocks locally.
Defaults to `'./.pear-drives/<pearTopicKey>'`.
