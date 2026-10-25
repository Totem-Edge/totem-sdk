[**@totemsdk/manifest**](../index.md)

***

[@totemsdk/manifest](../index.md) / computeManifestEnvelopeId

# Function: computeManifestEnvelopeId()

> **computeManifestEnvelopeId**(`signedManifest`): `string`

Content-addressed identity for a **signed manifest revision**.

`computeManifestId` is the durable logical identifier (stable across versions).
This envelope ID changes with the signed revision content (including signature
and signedAt) so ProofGraph can retain multiple revisions of one manifest.

## Parameters

### signedManifest

[`SignedManifest`](../interfaces/SignedManifest.md)

## Returns

`string`
