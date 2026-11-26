[**@totemsdk/vtxo**](../index.md)

***

[@totemsdk/vtxo](../index.md) / verifyVtxoReceiptForPool

# Function: verifyVtxoReceiptForPool()

> **verifyVtxoReceiptForPool**(`operator`, `receipt`, `pool`): `Promise`\<`boolean`\>

Verify a receipt against the pool's current anchored state, not a
caller-supplied root. Rejects a receipt from another pool/epoch and requires
the pool's committed root to be present.

## Parameters

### operator

[`OmniaVtxoOperator`](../interfaces/OmniaVtxoOperator.md)

### receipt

[`VtxoOperatorReceipt`](../interfaces/VtxoOperatorReceipt.md)

### pool

`Pick`\<[`OmniaVtxoPool`](../interfaces/OmniaVtxoPool.md), `"poolId"` \| `"epoch"` \| `"commitmentRoot"`\>

## Returns

`Promise`\<`boolean`\>
