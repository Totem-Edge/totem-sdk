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

> **signatures**: `Map`\<`string`, `Uint8Array`\<`ArrayBufferLike`\>\>

pubkey-hex (lowercase, no 0x) → flat 1088-byte WOTS signature
