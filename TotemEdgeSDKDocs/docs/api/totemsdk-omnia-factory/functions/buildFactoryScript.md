[**@totemsdk/omnia-factory**](../index.md)

***

[@totemsdk/omnia-factory](../index.md) / buildFactoryScript

# Function: buildFactoryScript()

> **buildFactoryScript**(`participants`): `string`

Build the N-of-N MULTISIG MAST funding script for a channel factory.

Spending rules:
  - Any cooperative close (SETTLEMENT=true): all N parties sign, spend after
    minimal coinage (1 block) so the factory can be closed immediately after
    a confirmed update.
  - Non-settlement path: all N parties must still sign (ASSERT MULTISIG(N ...))
    but can spend in the same block (no coinage requirement) — used for future
    optimistic factory updates if desired.

`storestate=true` is achieved by encoding STATE(100) in the output state
variables of every factory TX.

Minimum 2 participants required.

## Parameters

### participants

[`FactoryParticipant`](../interfaces/FactoryParticipant.md)[]

## Returns

`string`
