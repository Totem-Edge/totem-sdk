[**@totemsdk/node**](../index.md)

***

[@totemsdk/node](../index.md) / MASTHelper

# Class: MASTHelper

MAST Helper

Creates Merkelized Abstract Syntax Tree contracts for privacy and scalability.

## Constructors

### Constructor

> **new MASTHelper**(): `MASTHelper`

#### Returns

`MASTHelper`

## Methods

### buildDescriptor()

> `static` **buildDescriptor**(`address`, `rootHash`, `branchScript`, `branchProof`, `wotsPublicKey?`): [`ScriptDescriptor`](../interfaces/ScriptDescriptor.md)

Build ScriptDescriptor for spending a MAST branch.

#### Parameters

##### address

`string`

##### rootHash

`string`

##### branchScript

`string`

##### branchProof

`string`

##### wotsPublicKey?

`string`

#### Returns

[`ScriptDescriptor`](../interfaces/ScriptDescriptor.md)

***

### buildSimpleTree()

> `static` **buildSimpleTree**(`scripts`): `object`

Build a simple MAST tree from multiple scripts.
Returns the root hash and proofs for each script.

For a proper implementation, this should call the mmrcreate RPC.
This is a simplified local version for 2 scripts.

#### Parameters

##### scripts

`string`[]

#### Returns

`object`

##### proofs

> **proofs**: `Map`\<`string`, \{ `index`: `number`; `proof`: `string`; \}\>

##### root

> **root**: `string`

***

### createMASTScript()

> `static` **createMASTScript**(`rootHash`): `object`

Create a MAST script with the given root hash.

#### Parameters

##### rootHash

`string`

#### Returns

`object`

##### address

> **address**: `string`

##### script

> **script**: `string`

***

### hashScript()

> `static` **hashScript**(`script`): `string`

Compute hash of a script for MAST leaf.

#### Parameters

##### script

`string`

#### Returns

`string`
