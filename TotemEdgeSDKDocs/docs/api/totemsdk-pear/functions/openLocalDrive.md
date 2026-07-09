[**@totemsdk/pear**](../index.md)

***

[@totemsdk/pear](../index.md) / openLocalDrive

# Function: openLocalDrive()

> **openLocalDrive**(`storagePath`): `Promise`\<[`BareHyperdriveAdapter`](../classes/BareHyperdriveAdapter.md)\>

Open a **local** Hyperdrive from a Corestore path (no network required).

Useful when the drive content is already replicated locally or when the
caller manages replication separately.

## Parameters

### storagePath

`string`

## Returns

`Promise`\<[`BareHyperdriveAdapter`](../classes/BareHyperdriveAdapter.md)\>
