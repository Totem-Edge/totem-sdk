[**@totemsdk/proof**](../index.md)

***

[@totemsdk/proof](../index.md) / manifestContentId

# Function: manifestContentId()

> **manifestContentId**(`manifest`): `string`

Content id of a manifest revision: SHA3-256 over the canonical manifest.

`computeManifestId` is deliberately stable across versions (it identifies the
manifest, not the revision), so it cannot bind a proof to a specific version.
This digest changes with any field, version included. It mirrors the
canonicalisation `signManifest` signs over.

## Parameters

### manifest

`Manifest`

## Returns

`string`
