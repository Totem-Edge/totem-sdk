[**@totemsdk/omnia**](../index.md)

***

[@totemsdk/omnia](../index.md) / FinalizeChannelOpeningOptions

# Interface: FinalizeChannelOpeningOptions

## Properties

### fundingProofs?

> `optional` **fundingProofs?**: `object`

Input proofs required with `fundingSignature`.

#### coinProofs

> **coinProofs**: `Uint8Array`\<`ArrayBufferLike`\>[]

#### scriptProofs

> **scriptProofs**: `Uint8Array`\<`ArrayBufferLike`\>[]

***

### fundingScript?

> `optional` **fundingScript?**: `string`

Funding coin address script; the SDK derives its ScriptProof.

***

### fundingSignature?

> `optional` **fundingSignature?**: `Uint8Array`\<`ArrayBufferLike`\>

Wallet/coordinator flow: signature over `plan.fundingDigest`.

***

### fundingWitnessBytes?

> `optional` **fundingWitnessBytes?**: `Uint8Array`\<`ArrayBufferLike`\>

Serialized witness assembled by the caller (preferred when available).
