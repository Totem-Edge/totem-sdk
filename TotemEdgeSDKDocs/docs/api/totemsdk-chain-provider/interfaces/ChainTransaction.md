[**@totemsdk/chain-provider**](../index.md)

***

[@totemsdk/chain-provider](../index.md) / ChainTransaction

# Interface: ChainTransaction

A transaction body resolved from the chain (OMN-074).

Only the fields needed to prove provenance are modelled: which coins the
transaction spent and which outputs it created. A caller that needs byte
fidelity should use `minima-rpc` directly.

## Properties

### block?

> `optional` **block?**: `number`

Block height when the node reports the containing block.

***

### inputs

> **inputs**: `object`[]

#### address?

> `optional` **address?**: `string`

#### amount?

> `optional` **amount?**: `string`

#### coinId

> **coinId**: `string`

#### tokenId?

> `optional` **tokenId?**: `string`

***

### outputs

> **outputs**: `object`[]

#### address

> **address**: `string`

#### amount

> **amount**: `string`

#### coinId?

> `optional` **coinId?**: `string`

#### tokenId?

> `optional` **tokenId?**: `string`

***

### txpowid

> **txpowid**: `string`
