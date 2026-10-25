[**@totemsdk/kissvm**](../index.md)

***

[@totemsdk/kissvm](../index.md) / toMinimaProofExpression

# Function: toMinimaProofExpression()

> **toMinimaProofExpression**(`link`, `data?`, `options?`): `string`

Generate a canonical Minima 5-argument PROOF expression:

  PROOF(data leafSum rootHash rootSum proofHex)

`PROOF` hashes its **data** argument into the leaf via
`MMRData.CreateMMRDataLeafNode`, so `data` must be the leaf preimage — the
script / raw data — **not** the precomputed leaf hash (passing the hash would
double-hash and verify a different leaf than `compileMastTree` produced).

Defaults to `link.script` and auto-formats it as a `[ … ]` SCRIPT literal
(or, for `0x…` data, as HEX). When the preimage is a script at leaf-sum 0 the
call fails closed unless it hashes to `link.scriptHash`, so an unverifiable
PROOF cannot be emitted.

## Parameters

### link

[`ProofLink`](../interfaces/ProofLink.md)

### data?

`string`

### options?

`ProofExpressionOptions`

## Returns

`string`

## Throws

when there is no preimage, when `data` is the precomputed
`scriptHash`, or when a script preimage does not hash to `link.scriptHash`.
