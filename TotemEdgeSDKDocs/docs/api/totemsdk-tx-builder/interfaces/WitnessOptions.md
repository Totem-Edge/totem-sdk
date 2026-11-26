[**@totemsdk/tx-builder**](../index.md)

***

[@totemsdk/tx-builder](../index.md) / WitnessOptions

# Interface: WitnessOptions

## Extends

- [`WitnessProofs`](WitnessProofs.md)

## Properties

### coinProofs

> **coinProofs**: `Uint8Array`\<`ArrayBufferLike`\>[]

Serialized Minima CoinProof bytes, one per spending input.

#### Inherited from

[`WitnessProofs`](WitnessProofs.md).[`coinProofs`](WitnessProofs.md#coinproofs)

***

### scriptProofs

> **scriptProofs**: `Uint8Array`\<`ArrayBufferLike`\>[]

Serialized Minima ScriptProof bytes required by the input scripts.

#### Inherited from

[`WitnessProofs`](WitnessProofs.md).[`scriptProofs`](WitnessProofs.md#scriptproofs)

***

### signatures

> **signatures**: `Uint8Array`\<`ArrayBufferLike`\>[]

Serialized Minima Signature objects. Must match the transaction digest being broadcast.
