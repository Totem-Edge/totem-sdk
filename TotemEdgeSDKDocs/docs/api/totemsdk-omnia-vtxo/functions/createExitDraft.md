[**@totemsdk/omnia-vtxo**](../index.md)

***

[@totemsdk/omnia-vtxo](../index.md) / createExitDraft

# Function: createExitDraft()

> **createExitDraft**(`vtxo`, `now?`): `object`

Creates a mock exit draft for a VTXO. Validates the proof leaf before drafting.

## Parameters

### vtxo

[`OmniaVtxo`](../interfaces/OmniaVtxo.md)

### now?

`number`

Timestamp in ms. Defaults to Date.now() if omitted — pass explicitly for determinism.

## Returns

`object`

### draft

> **draft**: [`ExitDraft`](../interfaces/ExitDraft.md)

### receipt

> **receipt**: [`VtxoOperatorReceipt`](../interfaces/VtxoOperatorReceipt.md)
