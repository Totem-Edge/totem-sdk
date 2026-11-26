[**@totemsdk/vtxo**](../index.md)

***

[@totemsdk/vtxo](../index.md) / markExited

# Function: markExited()

> **markExited**(`vtxo`, `options`): [`OmniaVtxo`](../interfaces/OmniaVtxo.md)

One-step exit completion.

OMN-089: this is a **trusted reducer**. It now requires either chain evidence
(`evidence.confirmed`) or an explicit `trusted: true` declaration — a bare
transaction id is no longer enough to mark a VTXO as exited. Callers that
verified settlement elsewhere (for example the pool payout path, which checks
finality before calling) pass `trusted: true` and own that assertion.

## Parameters

### vtxo

[`OmniaVtxo`](../interfaces/OmniaVtxo.md)

### options

#### evidence?

[`ExitConfirmationEvidence`](../interfaces/ExitConfirmationEvidence.md)

#### now?

`number`

#### trusted?

`boolean`

#### txpowId

`string`

## Returns

[`OmniaVtxo`](../interfaces/OmniaVtxo.md)
