[**@totemsdk/edge**](../index.md)

***

[@totemsdk/edge](../index.md) / IssueUsageStatementOptions

# Interface: IssueUsageStatementOptions

## Properties

### agreement

> **agreement**: [`UsageAgreementReference`](UsageAgreementReference.md)

***

### now?

> `optional` **now?**: () => `number`

Injectable clock (defaults to Date.now).

#### Returns

`number`

***

### principal

> **principal**: `string`

The issuer (buyer principal) whose signature binds the statement.

***

### requestId

> **requestId**: `string`

***

### signer

> **signer**: `Signer`

Signature creation (WOTS).

***

### usage?

> `optional` **usage?**: [`InferenceRecordedUsage`](InferenceRecordedUsage.md)
