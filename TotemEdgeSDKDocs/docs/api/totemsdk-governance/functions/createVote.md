[**@totemsdk/governance**](../index.md)

***

[@totemsdk/governance](../index.md) / createVote

# Function: createVote()

> **createVote**(`params`): [`GovernanceResult`](../type-aliases/GovernanceResult.md)\<[`Vote`](../interfaces/Vote.md)\>

## Parameters

### params

#### castAt?

`number`

#### choice

`"yes"` \| `"no"` \| `"abstain"`

#### config?

[`GovernanceConfig`](../interfaces/GovernanceConfig.md)

#### delegations?

[`Delegation`](../interfaces/Delegation.md)[]

#### proposal

[`Proposal`](../interfaces/Proposal.md)

#### snapshot

[`MembershipSnapshot`](../interfaces/MembershipSnapshot.md)

#### voter

`string`

## Returns

[`GovernanceResult`](../type-aliases/GovernanceResult.md)\<[`Vote`](../interfaces/Vote.md)\>
