[**@totemsdk/vtxo**](../index.md)

***

[@totemsdk/vtxo](../index.md) / transitionPoolMembers

# Function: transitionPoolMembers()

> **transitionPoolMembers**(`pool`, `params`): `object`

OMN-055: atomically consume members and add replacement members, publishing a
new root at the target epoch. Transfer and refresh outputs become real pool
members only through this transition.

## Parameters

### pool

[`OmniaVtxoPool`](../interfaces/OmniaVtxoPool.md)

### params

#### add

readonly [`OmniaVtxo`](../interfaces/OmniaVtxo.md)[]

#### consume

readonly `string`[]

#### epoch?

`number`

## Returns

`object`

### pool

> **pool**: [`OmniaVtxoPool`](../interfaces/OmniaVtxoPool.md)

### proofs

> **proofs**: `Record`\<`string`, [`VtxoProof`](../interfaces/VtxoProof.md)\>
