[**@totemsdk/omnia-factory**](../index.md)

***

[@totemsdk/omnia-factory](../index.md) / factoryBalanceProof

# Function: factoryBalanceProof()

> **factoryBalanceProof**(`participants`, `index`): `string`

Serialized MMR inclusion proof (hex, no `0x`) for participant `index` against
the committed balance set-root — the witness for a `buildMmrMembershipCovenant`
balance escape (leaf sum = the participant's balance).

## Parameters

### participants

[`FactoryParticipant`](../interfaces/FactoryParticipant.md)[]

### index

`number`

## Returns

`string`
