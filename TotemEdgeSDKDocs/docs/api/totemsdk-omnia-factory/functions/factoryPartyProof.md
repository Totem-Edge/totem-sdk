[**@totemsdk/omnia-factory**](../index.md)

***

[@totemsdk/omnia-factory](../index.md) / factoryPartyProof

# Function: factoryPartyProof()

> **factoryPartyProof**(`participants`, `index`): `string`

Serialized MMR inclusion proof (hex, no `0x`) for participant `index` against
the committed party-set root — the witness for a per-leaf
`buildMmrMembershipCovenant` escape (RFC-048 §12.4).

## Parameters

### participants

[`FactoryParticipant`](../interfaces/FactoryParticipant.md)[]

### index

`number`

## Returns

`string`
