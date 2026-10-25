[**@totemsdk/industrial-action**](../index.md)

***

[@totemsdk/industrial-action](../index.md) / computeCommitmentHash

# Function: computeCommitmentHash()

> **computeCommitmentHash**(`proposal`): `string`

## Parameters

### proposal

#### context

`Record`\<`string`, `unknown`\>

#### kind

`string`

#### mandateProofId?

`string`

RFC-010 §6.4: the mandate proof that authorizes this action is bound into
the commitment preimage, so the device operation cannot be re-pointed at a
different mandate after the fact.

#### parameters

`Record`\<`string`, `unknown`\>

## Returns

`string`
