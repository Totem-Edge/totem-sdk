[**@totemsdk/location-proof**](../index.md)

***

[@totemsdk/location-proof](../index.md) / verifyLocationProof

# Function: verifyLocationProof()

> **verifyLocationProof**(`signed`, `options?`): [`LocationProofVerifyResult`](../interfaces/LocationProofVerifyResult.md)

Verify a signed location proof end to end.

Checks:
  1. the underlying @totemsdk/proof verification (signature, proofId, expiry)
  2. payload contains a structurally valid LocationClaim
  3. the claim's claimId matches a recomputation from its stable fields
  4. the location-claim evidence hash matches the payload claim
  5. the challenge (if present) has not expired

Anchoring is not required.

## Parameters

### signed

`SignedProof`

### options?

#### now?

`number`

## Returns

[`LocationProofVerifyResult`](../interfaces/LocationProofVerifyResult.md)
