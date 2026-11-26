[**@totemsdk/vtxo**](../index.md)

***

[@totemsdk/vtxo](../index.md) / createExitDraft

# Function: createExitDraft()

> **createExitDraft**(`vtxo`, `store`, `now?`): `Promise`\<[`ExitDraftReservation`](../interfaces/ExitDraftReservation.md) & `object`\>

Create **and reserve** an exit draft (OMN-088).

The VTXO's receipt is consumed by the reservation, and a repeat request
returns the original draft rather than producing a competing one. The store
is required: a draft that nobody reserved was the double-exit hole.

## Parameters

### vtxo

[`OmniaVtxo`](../interfaces/OmniaVtxo.md)

### store

[`VtxoExitDraftStore`](../interfaces/VtxoExitDraftStore.md)

### now?

`number`

## Returns

`Promise`\<[`ExitDraftReservation`](../interfaces/ExitDraftReservation.md) & `object`\>
