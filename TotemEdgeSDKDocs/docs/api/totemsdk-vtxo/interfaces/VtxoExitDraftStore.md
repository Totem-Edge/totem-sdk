[**@totemsdk/vtxo**](../index.md)

***

[@totemsdk/vtxo](../index.md) / VtxoExitDraftStore

# Interface: VtxoExitDraftStore

## Methods

### get()

> **get**(`vtxoId`): `Promise`\<[`ExitDraftReservation`](ExitDraftReservation.md) \| `undefined`\>

The reservation already recorded for a VTXO, if any.

#### Parameters

##### vtxoId

`string`

#### Returns

`Promise`\<[`ExitDraftReservation`](ExitDraftReservation.md) \| `undefined`\>

***

### reserve()

> **reserve**(`input`): `Promise`\<[`ExitDraftReservation`](ExitDraftReservation.md) & `object`\>

Atomically reserve an exit for a VTXO. A repeat for the same VTXO returns
the original draft instead of a second one.

#### Parameters

##### input

[`ExitDraftReservation`](ExitDraftReservation.md) & `object`

#### Returns

`Promise`\<[`ExitDraftReservation`](ExitDraftReservation.md) & `object`\>
