[**@totemsdk/location-proof**](../index.md)

***

[@totemsdk/location-proof](../index.md) / locationClaimToProofGraphNode

# Function: locationClaimToProofGraphNode()

> **locationClaimToProofGraphNode**(`claim`): `ProofGraphNode`

Build a ProofGraphNode for a location claim.

Uses the 'custom' node type (no native proofgraph node type fits a
location claim). Node ID is deterministic: "custom:<claimId>".

## Parameters

### claim

[`LocationClaim`](../interfaces/LocationClaim.md)

## Returns

`ProofGraphNode`
