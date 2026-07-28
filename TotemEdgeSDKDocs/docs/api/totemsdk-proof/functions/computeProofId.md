[**@totemsdk/proof**](../index.md)

***

[@totemsdk/proof](../index.md) / computeProofId

# Function: computeProofId()

> **computeProofId**(`input`): `string`

Compute a deterministic proof ID from the core unsigned fields (excluding proofId).
This is the primary ID rule — callers must strip `proofId` before passing in.

## Parameters

### input

`Omit`\<[`UnsignedProof`](../interfaces/UnsignedProof.md), `"proofId"`\>

## Returns

`string`
