[**@totemsdk/omnia-vtxo**](../index.md)

***

[@totemsdk/omnia-vtxo](../index.md) / OmniaVtxo

# Interface: OmniaVtxo

## Properties

### amount

> **amount**: `bigint`

***

### createdAt

> **createdAt**: `number`

***

### epoch

> **epoch**: `number`

***

### exitConsumedAt?

> `optional` **exitConsumedAt?**: `number`

Set when an exit draft consumed this VTXO — prevents double-exit.

***

### exitReceiptId?

> `optional` **exitReceiptId?**: `string`

***

### expiresAt?

> `optional` **expiresAt?**: `number`

***

### fundingProof?

> `optional` **fundingProof?**: `unknown`

The on-chain funding proof recorded at mint (deep proof, #28).

***

### history

> **history**: [`VtxoHistoryEntry`](VtxoHistoryEntry.md)[]

***

### owner

> **owner**: `string`

***

### poolId

> **poolId**: `string`

***

### proof

> **proof**: [`VtxoProof`](VtxoProof.md)

***

### status

> **status**: [`VtxoStatus`](../type-aliases/VtxoStatus.md)

***

### tokenId

> **tokenId**: `string`

***

### updatedAt

> **updatedAt**: `number`

***

### vtxoId

> **vtxoId**: `string`
