[**@totemsdk/vtxo**](../index.md)

***

[@totemsdk/vtxo](../index.md) / markExitBroadcast

# Function: markExitBroadcast()

> **markExitBroadcast**(`vtxo`, `options`): [`OmniaVtxo`](../interfaces/OmniaVtxo.md)

Record that an exit transaction exists. This is bookkeeping only: it does not
claim the transaction is confirmed or that it pays the right party.

## Parameters

### vtxo

[`OmniaVtxo`](../interfaces/OmniaVtxo.md)

### options

#### now?

`number`

#### txpowId

`string`

## Returns

[`OmniaVtxo`](../interfaces/OmniaVtxo.md)
