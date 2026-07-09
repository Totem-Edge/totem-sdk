[**@totemsdk/omnia-factory**](../index.md)

***

[@totemsdk/omnia-factory](../index.md) / computeFactoryStateCommitment

# Function: computeFactoryStateCommitment()

> **computeFactoryStateCommitment**(`factoryId`, `sequence`, `pendingAllocations`, `virtualChannelIds`): `Uint8Array`

Compute the canonical 32-byte state commitment for N-of-N factory signing.

Covers:
  - factoryId        (factory context isolation)
  - sequence         (monotonicity; prevents replay of old state)
  - pendingAllocations (the proposed allocation split being signed)
  - virtualChannelIds (list of currently open VCs; prevents forgery of VC state)

All fields are sorted lexicographically for determinism regardless of the
order in which keys appear in the caller's objects.

This commitment is what every party signs via `FactorySignerOps.sign`, and
what `FactorySignerOps.verify` checks against each stored signature.

## Parameters

### factoryId

`string`

### sequence

`number`

### pendingAllocations

`Record`\<`string`, `bigint`\>

### virtualChannelIds

`string`[]

## Returns

`Uint8Array`
