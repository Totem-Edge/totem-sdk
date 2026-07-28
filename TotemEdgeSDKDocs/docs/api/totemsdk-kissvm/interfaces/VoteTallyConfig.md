[**@totemsdk/kissvm**](../index.md)

***

[@totemsdk/kissvm](../index.md) / VoteTallyConfig

# Interface: VoteTallyConfig

## Properties

### abstainPort?

> `optional` **abstainPort?**: `number`

***

### governancePk

> **governancePk**: `string`

***

### minVoteBlocks

> **minVoteBlocks**: `bigint`

***

### noPort?

> `optional` **noPort?**: `number`

***

### quorumPct

> **quorumPct**: `number`

***

### totalPort?

> `optional` **totalPort?**: `number`

***

### votingEndPort?

> `optional` **votingEndPort?**: `number`

***

### votingStartPort?

> `optional` **votingStartPort?**: `number`

Ports for the voting window (must NOT overlap with yes/no/abstain/total ports).

***

### yesPort?

> `optional` **yesPort?**: `number`

Ports for yes/no/abstain/total vote counts (default 0-3).
