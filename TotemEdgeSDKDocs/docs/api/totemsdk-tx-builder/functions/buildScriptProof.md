[**@totemsdk/tx-builder**](../index.md)

***

[@totemsdk/tx-builder](../index.md) / buildScriptProof

# Function: buildScriptProof()

> **buildScriptProof**(`script`): `Uint8Array`

Build the canonical ScriptProof bytes for a single script (empty MMR proof).
This is the local equivalent of the node's `ScriptProof(script)` constructor
and of `txninput scriptmmr:true`.

## Parameters

### script

`string`

## Returns

`Uint8Array`
