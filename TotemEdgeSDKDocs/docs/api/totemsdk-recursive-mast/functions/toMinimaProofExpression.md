[**@totemsdk/recursive-mast**](../index.md)

***

[@totemsdk/recursive-mast](../index.md) / toMinimaProofExpression

# Function: toMinimaProofExpression()

> **toMinimaProofExpression**(`link`): `string`

Generate a canonical Minima 5-argument PROOF expression.

Canonical Minima syntax: PROOF(data, leafSum, rootHash, rootSum, proofHex)

## Parameters

### link

[`ProofLink`](../interfaces/ProofLink.md)

## Returns

`string`

Minima expression: `PROOF(0x<scriptHash> <leafSum> 0x<policyRoot> <rootSum> 0x<proof>)`
