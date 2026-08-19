[**@totemsdk/spatial-proof**](../index.md)

***

[@totemsdk/spatial-proof](../index.md) / verifySpatialProof

# Function: verifySpatialProof()

> **verifySpatialProof**(`signed`): [`SpatialProofVerifyResult`](../interfaces/SpatialProofVerifyResult.md)

Verify a signed spatial proof end to end.

Checks:
  1. the underlying @totemsdk/proof verification (signature, proofId, expiry)
  2. payload contains a structurally valid SpatialRelationClaim
  3. the relation's claimId matches a recomputation from its fields
  4. the relation evidence hash matches the payload claim
  5. the spatial-object evidence hash matches the payload claim inputs
  6. any subject geometry evidence hash is present when claimed

Anchoring is not required.

## Parameters

### signed

`SignedProof`

## Returns

[`SpatialProofVerifyResult`](../interfaces/SpatialProofVerifyResult.md)
