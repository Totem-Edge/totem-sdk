[**@totemsdk/kissvm**](../index.md)

***

[@totemsdk/kissvm](../index.md) / ProposalConfig

# Interface: ProposalConfig

## Properties

### executionDelayBlocks

> **executionDelayBlocks**: `bigint`

Execution delay in blocks (applied after votingEndsAt).

***

### governancePks

> **governancePks**: `string`[]

***

### multisigThreshold

> **multisigThreshold**: `number`

Number of governance keys required to sign execution (passed→executed).

***

### proposerPort?

> `optional` **proposerPort?**: `number`

Port storing the proposer's public key (default 4).

***

### snapshotPort?

> `optional` **snapshotPort?**: `number`

Port storing the membership snapshot hash (default 5).
