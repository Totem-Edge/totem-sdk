[**@totemsdk/liquidity-bond**](../index.md)

***

[@totemsdk/liquidity-bond](../index.md) / OperatorAutobond

# Interface: OperatorAutobond

Operator autobond (#5): a WOTS signature by the pool operator over the
load-bearing pool parameters (poolId, asset, totalCapacity, lockTerms,
feePolicy). Signed manifests are the anchor of truth — an operator cannot
forge a pool they never committed to.

## Properties

### address

> **address**: `string`

Address derived from the signer's public key digest.

***

### autobondId

> **autobondId**: `string`

***

### createdAt

> **createdAt**: `number`

***

### payloadHash

> **payloadHash**: `string`

sha3_256(domain | canonicalJson({poolId, asset, totalCapacity, lockTerms, feePolicy}))

***

### publicKeyDigest

> **publicKeyDigest**: `string`

***

### signature

> **signature**: `string`
