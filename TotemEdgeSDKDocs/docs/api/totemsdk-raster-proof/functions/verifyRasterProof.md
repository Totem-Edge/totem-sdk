[**@totemsdk/raster-proof**](../index.md)

***

[@totemsdk/raster-proof](../index.md) / verifyRasterProof

# Function: verifyRasterProof()

> **verifyRasterProof**(`signed`): [`RasterProofVerifyResult`](../interfaces/RasterProofVerifyResult.md)

Verify a signed raster proof end to end.

Checks:
  1. the underlying @totemsdk/proof verification (signature, proofId, expiry)
  2. payload contains a structurally valid RasterManifest
  3. the manifest rasterId matches a recomputation from its fields
  4. the manifest evidence hash matches the payload manifest
  5. content hash and Merkle root evidence refs are present when declared
  6. window proof (when supplied) has a recomputable ID, matches the
     manifest's Merkle root, and any supplied Merkle proofs verify
  7. provenance structure is valid for derived rasters

Anchoring is not required. Source raster manifests are not supplied inside
the proof, so derivation checks are structural only (full cross-source
verification is @totemsdk/raster-proof's verifyRasterDerivation).

## Parameters

### signed

`SignedProof`

## Returns

[`RasterProofVerifyResult`](../interfaces/RasterProofVerifyResult.md)
