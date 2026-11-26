[**@totemsdk/manifest**](../index.md)

***

[@totemsdk/manifest](../index.md) / computeManifestContentId

# Function: computeManifestContentId()

> **computeManifestContentId**(`manifest`): `string`

Content id of a manifest **revision**: SHA3-256 over the canonical manifest.

Unlike `computeManifestId` (stable across versions), this changes whenever any
field changes — version included. A proof that attests "this manifest" must
bind to this id, otherwise a proof for one version verifies for another.

## Parameters

### manifest

[`Manifest`](../type-aliases/Manifest.md)

## Returns

`string`
