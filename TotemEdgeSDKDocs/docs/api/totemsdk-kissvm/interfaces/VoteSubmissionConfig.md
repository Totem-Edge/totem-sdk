[**@totemsdk/kissvm**](../index.md)

***

[@totemsdk/kissvm](../index.md) / VoteSubmissionConfig

# Interface: VoteSubmissionConfig

## Properties

### governancePk

> **governancePk**: `string`

***

### noncePort

> **noncePort**: `number`

Port storing the per-voter nonce to prevent double voting.

***

### snapshotPort

> **snapshotPort**: `number`

Port storing the frozen membership snapshot hash.

***

### votingEndBlock

> **votingEndBlock**: `bigint`

Voting window end block (baked in as constant).

***

### votingStartBlock

> **votingStartBlock**: `bigint`

Voting window start block (baked in as constant).

***

### weightPort

> **weightPort**: `number`

Port storing the voter's attested membership weight.
