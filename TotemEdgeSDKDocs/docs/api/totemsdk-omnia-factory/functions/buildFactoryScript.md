[**@totemsdk/omnia-factory**](../index.md)

***

[@totemsdk/omnia-factory](../index.md) / buildFactoryScript

# Function: buildFactoryScript()

> **buildFactoryScript**(`participants`, `_options?`): `string`

Build the N-of-N MULTISIG MAST funding script for a channel factory
(RFC-039, CUSTODY-POLICY §2).

Spend paths:
  - **Cooperative / update** (any time): `MULTISIG(N …)` — all parties sign.
    `settlement=true` closes after minimal coinage (1 block).
  - **Unilateral escape** (after the absolute block in `STATE(103)`): any
    single party k may withdraw its allocation `SHARE_k = PREVSTATE(base+k)`
    (the spent coin's share) to its own settlement address, zero its state in
    the successor (`STATE(base+k) EQ 0`), keep the other parties' balances
    unchanged, and return the remainder to the factory script. Repeated
    withdrawals cannot double-claim because each zeroes its own port. `STATE(103)` is immutable on every spend (`SAMESTATE(103 103)`),
    so the escape clock cannot be pushed by any counterparty.

Minimum 2 participants required.

## Parameters

### participants

[`FactoryParticipant`](../interfaces/FactoryParticipant.md)[]

### \_options?

`FactoryScriptOptions` = `{}`

## Returns

`string`
