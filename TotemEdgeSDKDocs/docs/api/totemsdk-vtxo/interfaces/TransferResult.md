[**@totemsdk/vtxo**](../index.md)

***

[@totemsdk/vtxo](../index.md) / TransferResult

# Interface: TransferResult

## Properties

### change?

> `optional` **change?**: [`OmniaVtxo`](OmniaVtxo.md)

***

### exitEntitlement?

> `optional` **exitEntitlement?**: [`VtxoExitEntitlement`](VtxoExitEntitlement.md)

The recipient-bound entitlement, when one was supplied and verified.

***

### exitReady

> **exitReady**: `boolean`

True only when `output.exitEntitlement` was verified against the *output*
VTXO (recipient owner, output id, output amount) in this call. A transfer
without an entitlement is never exit-ready (OMN-003).

***

### input

> **input**: [`OmniaVtxo`](OmniaVtxo.md)

***

### output

> **output**: [`OmniaVtxo`](OmniaVtxo.md)

***

### transfer

> **transfer**: [`VtxoTransfer`](VtxoTransfer.md)
