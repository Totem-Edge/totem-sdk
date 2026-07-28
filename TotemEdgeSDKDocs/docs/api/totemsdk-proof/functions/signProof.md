[**@totemsdk/proof**](../index.md)

***

[@totemsdk/proof](../index.md) / signProof

# Function: signProof()

> **signProof**(`unsignedProof`, `seed`, `keyIndex`): [`SignedProof`](../interfaces/SignedProof.md)

Sign an UnsignedProof with a WOTS key.
The digest is SHA3-256 of the canonical JSON of the full UnsignedProof
(including proofId). signature.message is NOT set — it is optional debug-only.

The caller is responsible for reserving the WOTS key index before calling
this function. This package does NOT depend on @totemsdk/wots-lease.

## Parameters

### unsignedProof

[`UnsignedProof`](../interfaces/UnsignedProof.md)

### seed

`Uint8Array`

### keyIndex

`number`

## Returns

[`SignedProof`](../interfaces/SignedProof.md)
