[**@totemsdk/vtxo**](../index.md)

***

[@totemsdk/vtxo](../index.md) / OmniaVtxoPool

# Interface: OmniaVtxoPool

## Properties

### availableCapacity

> **availableCapacity**: `bigint`

***

### backing?

> `optional` **backing?**: [`VtxoPoolBacking`](VtxoPoolBacking.md)

OMN-041: verified on-chain coin backing this pool's capacity.

***

### commitmentRoot

> **commitmentRoot**: `string`

Root of the pool-wide membership set (`members`). Appended to by every
batch; earlier epoch roots are retained in `epochRoots`.

***

### consumedVtxoIds?

> `optional` **consumedVtxoIds?**: `string`[]

OMN-055: ids consumed by a transfer/refresh/exit. A consumed VTXO can
never re-enter the membership set.

***

### createdAt

> **createdAt**: `number`

***

### epoch

> **epoch**: `number`

***

### epochRoots

> **epochRoots**: [`VtxoEpochRoot`](VtxoEpochRoot.md)[]

Every root the pool has published, oldest first.

***

### members

> **members**: [`VtxoPoolMember`](VtxoPoolMember.md)[]

Append-only membership set. `mintVtxo` appends a member and rebuilds the
tree instead of replacing the root with a single-leaf tree (OMN-002).

***

### operator

> **operator**: `string`

***

### policy

> **policy**: [`VtxoPoolPolicy`](VtxoPoolPolicy.md)

***

### poolId

> **poolId**: `string`

***

### tokenId

> **tokenId**: `string`

***

### totalCapacity

> **totalCapacity**: `bigint`
