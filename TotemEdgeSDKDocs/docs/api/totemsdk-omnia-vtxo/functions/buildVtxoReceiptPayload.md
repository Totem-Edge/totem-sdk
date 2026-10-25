[**@totemsdk/omnia-vtxo**](../index.md)

***

[@totemsdk/omnia-vtxo](../index.md) / buildVtxoReceiptPayload

# Function: buildVtxoReceiptPayload()

> **buildVtxoReceiptPayload**(`receipt`, `batch`): `Uint8Array`

Co-sign a receipt with the operator, after verifying the batch.

## Parameters

### receipt

[`VtxoOperatorReceipt`](../interfaces/VtxoOperatorReceipt.md)

### batch

[`VtxoReceiptBatch`](../interfaces/VtxoReceiptBatch.md)

## Returns

`Uint8Array`

## Throws

if the root does not commit the leaves, the epoch is stale, an output
is not in the batch, or conservation fails.
