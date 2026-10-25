[**@totemsdk/omnia-vtxo**](../index.md)

***

[@totemsdk/omnia-vtxo](../index.md) / ExitTxParams

# Interface: ExitTxParams

## Properties

### amount

> **amount**: `bigint`

Total pool amount (raw base units).

***

### epoch

> **epoch**: `number`

***

### exitBlock

> **exitBlock**: `number`

***

### fundingAddress

> **fundingAddress**: `string`

***

### fundingCoinId

> **fundingCoinId**: `string`

The pool's on-chain coin (input).

***

### fundingScript

> **fundingScript**: `string`

***

### holderIndex

> **holderIndex**: `number`

Index of the exiting holder (must match `vtxo.owner`).

***

### holders

> **holders**: `string`[]

Pool holders + committed shares (aligned arrays).

***

### root

> **root**: `string`

Pool state, needed to rebuild the remainder output's state.

***

### shares

> **shares**: `bigint`[]

***

### vtxo

> **vtxo**: [`OmniaVtxo`](OmniaVtxo.md)
