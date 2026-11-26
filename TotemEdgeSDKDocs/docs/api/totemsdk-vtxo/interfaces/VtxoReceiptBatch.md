[**@totemsdk/vtxo**](../index.md)

***

[@totemsdk/vtxo](../index.md) / VtxoReceiptBatch

# Interface: VtxoReceiptBatch

The batch the receipt belongs to — the operator's source of truth.

## Properties

### epoch

> **epoch**: `number`

The batch epoch.

***

### inputsAmount?

> `optional` **inputsAmount?**: `bigint`

Optional: total input amount, for a conservation check.

***

### outputs

> **outputs**: [`OmniaVtxo`](OmniaVtxo.md)[]

The VTXOs committed in this epoch's batch.

***

### poolMembers?

> `optional` **poolMembers?**: `object`[]

OMN-047: the pool's authoritative member set. Pool-wide mint roots commit
every accumulated member, so a receipt must be verified against that set
rather than a root rebuilt from only the new outputs.

#### leaf

> **leaf**: `string`

#### vtxoId

> **vtxoId**: `string`

***

### previousEpoch?

> `optional` **previousEpoch?**: `number`

The pool's current epoch, for monotonicity (must be strictly less).

***

### root

> **root**: `string`

The batch root the receipt claims (the operator recomputes and compares).
