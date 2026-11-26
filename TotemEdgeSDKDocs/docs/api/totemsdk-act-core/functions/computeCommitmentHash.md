[**@totemsdk/act-core**](../index.md)

***

[@totemsdk/act-core](../index.md) / computeCommitmentHash

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

#### preparedCommandHash?

`string`

RFC-022 §5.2: canonical hash of the actually prepared device command. It is
null for proposals, which have not yet reached preparation.

## Returns

`string`
