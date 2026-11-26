[**@totemsdk/vtxo**](../index.md)

***

[@totemsdk/vtxo](../index.md) / OmniaVtxo

# Interface: OmniaVtxo

## Properties

### amount

> **amount**: `bigint`

***

### claimPolicy?

> `optional` **claimPolicy?**: [`VtxoClaimPolicy`](../type-aliases/VtxoClaimPolicy.md)

Opt-in multiparty claim policy (M8–M18).

***

### createdAt

> **createdAt**: `number`

***

### epoch

> **epoch**: `number`

***

### exitBlock?

> `optional` **exitBlock?**: `number`

Block that confirmed the exit, when the verifier supplied one.

***

### exitConsumedAt?

> `optional` **exitConsumedAt?**: `number`

Set when an exit draft consumed this VTXO — prevents double-exit.

***

### exitEntitlement?

> `optional` **exitEntitlement?**: [`VtxoExitEntitlement`](VtxoExitEntitlement.md)

V1: independently executable exit package delivered to the owner.

***

### exitReceiptId?

> `optional` **exitReceiptId?**: `string`

***

### exitState?

> `optional` **exitState?**: [`VtxoExitState`](../type-aliases/VtxoExitState.md)

OMN-089: how far the exit has progressed. `broadcast` means only that a
transaction id is known; `confirmed` means chain evidence accepted it;
`settled` is the final transition.

***

### exitTxpowId?

> `optional` **exitTxpowId?**: `string`

The exit transaction's txpowId (set once the exit is broadcast).

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
