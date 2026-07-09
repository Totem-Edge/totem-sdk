[**@totemsdk/core**](../index.md)

***

[@totemsdk/core](../index.md) / HierarchicalWitnessBundle

# Interface: HierarchicalWitnessBundle

Hierarchical witness bundle produced by per-address TreeKey signing.

Index mapping:
  addressIndex — which HD address (0-63)
  l1           — L1 index within per-address TreeKey (0-63)
  l2           — L2 index within per-address TreeKey (0-63)

proofs contains 3 entries for depth-3 TreeKeys (Root→L1→L2→DATA),
matching Minima's TreeKey.sign() exactly.

## Properties

### addressIndex

> **addressIndex**: `number`

***

### l1

> **l1**: `number`

***

### l2

> **l2**: `number`

***

### proofs

> **proofs**: `SignatureProofHex`[]

***

### rootPublicKey

> **rootPublicKey**: `string`
