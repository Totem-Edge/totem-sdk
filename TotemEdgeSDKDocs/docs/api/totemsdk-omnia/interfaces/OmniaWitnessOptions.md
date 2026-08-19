[**@totemsdk/omnia**](../index.md)

***

[@totemsdk/omnia](../index.md) / OmniaWitnessOptions

# Interface: OmniaWitnessOptions

## Extends

- [`OmniaWitnessProofs`](OmniaWitnessProofs.md)

## Properties

### coinProofs

> **coinProofs**: `Uint8Array`\<`ArrayBufferLike`\>[]

Serialized Minima CoinProof bytes, one per spending input.

#### Inherited from

[`OmniaWitnessProofs`](OmniaWitnessProofs.md).[`coinProofs`](OmniaWitnessProofs.md#coinproofs)

***

### scriptProofs

> **scriptProofs**: `Uint8Array`\<`ArrayBufferLike`\>[]

Serialized Minima ScriptProof bytes required by the input scripts.

#### Inherited from

[`OmniaWitnessProofs`](OmniaWitnessProofs.md).[`scriptProofs`](OmniaWitnessProofs.md#scriptproofs)

***

### signatures

> **signatures**: `Uint8Array`\<`ArrayBufferLike`\>[]

Serialized Minima Signature objects. Must match the transaction digest being broadcast.
