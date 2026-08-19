[**@totemsdk/governance**](../index.md)

***

[@totemsdk/governance](../index.md) / computeSnapshotHash

# Function: computeSnapshotHash()

> **computeSnapshotHash**(`daoId`, `frozenAt`, `entries`): `string`

Canonical snapshot hash.

Covers every field that determines voting eligibility: `memberId`, `role`,
`weight`, `addedAt`, `addedBy`, and `expiresAt`. Omitting any of these would
let an attacker mutate eligibility metadata (e.g. grant a role, extend an
expiry, or backdate an `addedAt`) without invalidating the snapshot hash.

## Parameters

### daoId

`string`

### frozenAt

`number`

### entries

[`MembershipEntry`](../interfaces/MembershipEntry.md)[]

## Returns

`string`
