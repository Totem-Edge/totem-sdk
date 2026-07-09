[**@totemsdk/node**](../index.md)

***

[@totemsdk/node](../index.md) / MMRTree

# Class: MMRTree

Simple MMR Tree for TreeKeyNode
Builds a perfect binary tree from N entries (N must be power of 2 for simplicity)

This matches TreeKeyNode.java which always uses 64 leaves (2^6)

## Constructors

### Constructor

> **new MMRTree**(): `MMRTree`

#### Returns

`MMRTree`

## Methods

### addLeaf()

> **addLeaf**(`data`): [`MMREntry`](../interfaces/MMREntry.md)

Add a leaf entry to the MMR
Matches MMR.java addEntry() but simplified for power-of-2 trees

#### Parameters

##### data

[`MMRData`](../interfaces/MMRData.md)

#### Returns

[`MMREntry`](../interfaces/MMREntry.md)

***

### getLeaf()

> **getLeaf**(`index`): [`MMRData`](../interfaces/MMRData.md) \| `null`

Get the leaf MMRData at a specific index

#### Parameters

##### index

`number`

#### Returns

[`MMRData`](../interfaces/MMRData.md) \| `null`

***

### getProof()

> **getProof**(`leafIndex`): [`MMRProof`](../interfaces/MMRProof.md)

Get proof for a leaf at given index
Matches MMR.java getProofToPeak()

#### Parameters

##### leafIndex

`number`

#### Returns

[`MMRProof`](../interfaces/MMRProof.md)

***

### getRoot()

> **getRoot**(): [`MMRData`](../interfaces/MMRData.md) \| `null`

Get the root of the tree
For a perfect binary tree with N leaves, root is at row log2(N), entry 0

#### Returns

[`MMRData`](../interfaces/MMRData.md) \| `null`

***

### fromPublicKeys()

> `static` **fromPublicKeys**(`pubkeys`): `MMRTree`

Build tree from array of Winternitz public keys
Used by TreeKeyNode to compute wallet public key

#### Parameters

##### pubkeys

`Bytes`[]

#### Returns

`MMRTree`
