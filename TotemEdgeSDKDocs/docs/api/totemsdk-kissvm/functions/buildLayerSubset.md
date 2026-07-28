[**@totemsdk/kissvm**](../index.md)

***

[@totemsdk/kissvm](../index.md) / buildLayerSubset

# Function: buildLayerSubset()

> **buildLayerSubset**(`config`, `include`): `object`

Build a subset of layers — useful when some layers are optional.
Only includes layers that are present in the `include` array.

## Parameters

### config

[`LayeredPolicyConfig`](../interfaces/LayeredPolicyConfig.md)

### include

`string`[]

## Returns

`object`

### proofChain

> **proofChain**: [`ProofChain`](../interfaces/ProofChain.md)

### tree

> **tree**: [`PolicyTree`](../interfaces/PolicyTree.md)
