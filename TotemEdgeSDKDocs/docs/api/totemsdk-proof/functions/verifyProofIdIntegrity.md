[**@totemsdk/proof**](../index.md)

***

[@totemsdk/proof](../index.md) / verifyProofIdIntegrity

# Function: verifyProofIdIntegrity()

> **verifyProofIdIntegrity**(`signedProof`): `boolean`

Verify that the proofId in a SignedProof matches a recomputation from its
unsigned fields. This prevents callers from replacing the proofId after
signing and relying on a stale identifier.

## Parameters

### signedProof

[`SignedProof`](../interfaces/SignedProof.md)

## Returns

`boolean`
