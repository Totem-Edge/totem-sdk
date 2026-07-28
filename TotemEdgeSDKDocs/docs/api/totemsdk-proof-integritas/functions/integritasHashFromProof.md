[**@totemsdk/proof-integritas**](../index.md)

***

[@totemsdk/proof-integritas](../index.md) / integritasHashFromProof

# Function: integritasHashFromProof()

> **integritasHashFromProof**(`signedProof`): `string`

Compute the canonical hash submitted to Integritas for a given SignedProof.
Uses createAnchorCommitment so the hash is deterministic and tied to the
proof's identity — same proof always produces the same hash.

## Parameters

### signedProof

`SignedProof`

## Returns

`string`
