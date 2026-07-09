[**@totemsdk/pear**](../index.md)

***

[@totemsdk/pear](../index.md) / loadManifest

# Function: loadManifest()

> **loadManifest**(`pearTopicKey`, `adapter?`, `options?`): `Promise`\<[`SignedManifest`](../interfaces/SignedManifest.md)\>

Load and parse `manifest.json` from a remote Hyperdrive identified by
its 64-hex `pearTopicKey`.

- Joins Hyperswarm to locate peers for the given topic key.
- Reads `/manifest.json` from the replicated drive.
- If `@totemsdk/app-manifest` is installed its `decodeManifest` is used
  for schema validation; otherwise the raw JSON is returned.

Pass a pre-opened `adapter` to skip the network join (useful in tests).

## Parameters

### pearTopicKey

`string`

### adapter?

[`HyperdriveAdapter`](../interfaces/HyperdriveAdapter.md)

### options?

[`RemoteDriveOptions`](../interfaces/RemoteDriveOptions.md)

## Returns

`Promise`\<[`SignedManifest`](../interfaces/SignedManifest.md)\>
