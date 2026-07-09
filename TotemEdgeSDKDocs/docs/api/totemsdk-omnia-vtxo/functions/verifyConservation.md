[**@totemsdk/omnia-vtxo**](../index.md)

***

[@totemsdk/omnia-vtxo](../index.md) / verifyConservation

# Function: verifyConservation()

> **verifyConservation**(`params`): [`VerifyVtxoResult`](../interfaces/VerifyVtxoResult.md)

Verifies amount conservation across a set of inputs and outputs.

Default mode (`'lte'`): `sum(outputs) <= sum(inputs)` — allows exits, fees, and burn flows.
Strict mode (`'strict'`): `sum(outputs) === sum(inputs)` — required for transfer, split, merge.

Always requires: same `poolId` and `tokenId` across all inputs and outputs.

## Parameters

### params

[`ConservationInput`](../interfaces/ConservationInput.md)

## Returns

[`VerifyVtxoResult`](../interfaces/VerifyVtxoResult.md)
