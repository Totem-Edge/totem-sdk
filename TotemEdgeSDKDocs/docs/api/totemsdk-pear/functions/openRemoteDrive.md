[**@totemsdk/pear**](../index.md)

***

[@totemsdk/pear](../index.md) / openRemoteDrive

# Function: openRemoteDrive()

> **openRemoteDrive**(`pearTopicKey`, `options?`): `Promise`\<[`BareHyperdriveAdapter`](../classes/BareHyperdriveAdapter.md) & `object`\>

Open a **remote** Hyperdrive identified by its 64-hex `pearTopicKey`.

Steps:
  1. Creates a Corestore for local block caching.
  2. Creates a Hyperswarm and joins the topic derived from `pearTopicKey`.
  3. Plumbs each swarm connection into Corestore's replication stream.
  4. Opens a Hyperdrive seeded with the public key derived from `pearTopicKey`.
  5. Waits for the drive to become `ready` (blocks are fetched from peers).

## Parameters

### pearTopicKey

`string`

— 64-hex public key of the Hyperdrive's root Hypercore

### options?

[`RemoteDriveOptions`](../interfaces/RemoteDriveOptions.md) = `{}`

— optional storage path + connect timeout overrides

## Returns

`Promise`\<[`BareHyperdriveAdapter`](../classes/BareHyperdriveAdapter.md) & `object`\>
