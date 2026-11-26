[**@totemsdk/vtxo**](../index.md)

***

[@totemsdk/vtxo](../index.md) / markExitConfirmed

# Function: markExitConfirmed()

> **markExitConfirmed**(`vtxo`, `options`): `Promise`\<[`OmniaVtxo`](../interfaces/OmniaVtxo.md)\>

Record chain confirmation of the exit, from an authoritative verifier.

The verifier is required: without one there is nothing to distinguish a real
confirmation from a caller asserting one.

## Parameters

### vtxo

[`OmniaVtxo`](../interfaces/OmniaVtxo.md)

### options

#### now?

`number`

#### txpowId

`string`

#### verify

(`input`) => [`ExitConfirmationEvidence`](../interfaces/ExitConfirmationEvidence.md) \| `Promise`\<[`ExitConfirmationEvidence`](../interfaces/ExitConfirmationEvidence.md)\>

## Returns

`Promise`\<[`OmniaVtxo`](../interfaces/OmniaVtxo.md)\>
