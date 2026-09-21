[**@totemsdk/edge**](../index.md)

***

[@totemsdk/edge](../index.md) / issueUsageStatement

# Function: issueUsageStatement()

> **issueUsageStatement**(`opts`): `Promise`\<`UsageStatement`\>

Build and sign a bounded usage statement for one completed dispatch.

`statementId` is deterministic over the request: `${agreementId}:${requestId}:usage`.
Idempotency follows from the deterministic messageId over the signed payload.

## Parameters

### opts

[`IssueUsageStatementOptions`](../interfaces/IssueUsageStatementOptions.md)

## Returns

`Promise`\<`UsageStatement`\>
