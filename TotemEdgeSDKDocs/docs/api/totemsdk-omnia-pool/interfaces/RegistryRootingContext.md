[**@totemsdk/omnia-pool**](../index.md)

***

[@totemsdk/omnia-pool](../index.md) / RegistryRootingContext

# Interface: RegistryRootingContext

Optional signing context that makes a registry transition anchorable.

## Properties

### op?

> `optional` **op?**: `RegistryOperation`

***

### previousRoot?

> `optional` **previousRoot?**: `string`

***

### reason?

> `optional` **reason?**: `string`

***

### signer

> **signer**: `RegistryTransitionSigner`

***

### signIndices

> **signIndices**: `SigningIndices`

WOTS indices leased for this transition. Required (AUD-006): registry
signing never defaults to a reusable genesis index.
