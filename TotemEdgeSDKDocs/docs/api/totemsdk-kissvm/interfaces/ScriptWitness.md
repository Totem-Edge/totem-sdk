[**@totemsdk/kissvm**](../index.md)

***

[@totemsdk/kissvm](../index.md) / ScriptWitness

# Interface: ScriptWitness

Witness supplied for signature verification

## Properties

### preimages?

> `optional` **preimages?**: `Map`\<`string`, `string`\>

HTLC: hash hex → preimage hex

***

### signatures

> **signatures**: `Map`\<`string`, `Uint8Array`\<`ArrayBufferLike`\>\>

pubkey-hex (lowercase, no 0x) → flat 1088-byte WOTS signature
