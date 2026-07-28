[**@totemsdk/governance**](../index.md)

***

[@totemsdk/governance](../index.md) / resolveVotingPower

# Function: resolveVotingPower()

> **resolveVotingPower**(`memberId`, `daoId`, `snapshot`, `delegations`, `options?`): `object`

## Parameters

### memberId

`string`

### daoId

`string`

### snapshot

[`MembershipSnapshot`](../interfaces/MembershipSnapshot.md)

### delegations

[`Delegation`](../interfaces/Delegation.md)[]

### options?

#### maxDepth?

`number`

#### processedDelegators?

`Set`\<`string`\>

#### proposalId?

`string`

## Returns

`object`

### delegatedFrom

> **delegatedFrom**: `object`[]

### directWeight

> **directWeight**: `number`

### totalWeight

> **totalWeight**: `number`
