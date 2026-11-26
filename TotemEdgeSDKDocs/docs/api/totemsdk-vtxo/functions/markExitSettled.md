[**@totemsdk/vtxo**](../index.md)

***

[@totemsdk/vtxo](../index.md) / markExitSettled

# Function: markExitSettled()

> **markExitSettled**(`vtxo`, `options`): [`OmniaVtxo`](../interfaces/OmniaVtxo.md)

Final transition: the exit is settled and the VTXO is no longer a claim on
the pool. Requires a prior confirmation, or explicit evidence for the callers
that verified settlement in another layer.

## Parameters

### vtxo

[`OmniaVtxo`](../interfaces/OmniaVtxo.md)

### options

#### evidence?

[`ExitConfirmationEvidence`](../interfaces/ExitConfirmationEvidence.md)

#### now?

`number`

#### txpowId

`string`

## Returns

[`OmniaVtxo`](../interfaces/OmniaVtxo.md)
