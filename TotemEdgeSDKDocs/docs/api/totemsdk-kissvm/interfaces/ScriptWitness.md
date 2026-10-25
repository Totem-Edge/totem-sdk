[**@totemsdk/kissvm**](../index.md)

***

[@totemsdk/kissvm](../index.md) / ScriptWitness

# Interface: ScriptWitness

Witness supplied for signature and MAST verification

## Properties

### preimages?

> `optional` **preimages?**: `Map`\<`string`, `string`\>

HTLC: hash hex → preimage hex

***

### scriptProofs?

> `optional` **scriptProofs?**: [`ScriptProof`](ScriptProof.md)[]

Canonical ScriptProofs for MAST branch revelation.
The evaluator verifies each proof against the MAST root before executing.

***

### signatures

> **signatures**: `Map`\<`string`, `TreeSignature` \| `Uint8Array`\<`ArrayBufferLike`\>\>

Signer-root-key hex (lowercase, no 0x) → signature.

- `Uint8Array`: a flat 1088-byte WOTS signature (single-key convenience),
  verified against the key as a bare WOTS public-key digest.
- `TreeSignature` (`{ proofs }`, RFC-009): a Minima tree signature whose
  root public key is the signer identity; verified with
  `verifyTreeSignature` (proof chain to the root).
