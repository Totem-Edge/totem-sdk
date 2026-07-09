[**@totemsdk/core**](../index.md)

***

[@totemsdk/core](../index.md) / TreeSignature

# Interface: TreeSignature

Full Signature structure matching Minima's Signature.java

For a 3-level tree, contains 3 SignatureProofs:
- Level 0: Signs level 1's root public key
- Level 1: Signs level 2's root public key
- Level 2: Signs the actual data

## Properties

### proofs

> **proofs**: [`SignatureProof`](SignatureProof.md)[]
