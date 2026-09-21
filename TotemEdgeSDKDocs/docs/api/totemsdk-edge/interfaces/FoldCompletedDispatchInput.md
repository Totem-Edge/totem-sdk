[**@totemsdk/edge**](../index.md)

***

[@totemsdk/edge](../index.md) / FoldCompletedDispatchInput

# Interface: FoldCompletedDispatchInput

## Properties

### context

> **context**: `Record`\<`string`, `unknown`\> \| `undefined`

***

### now?

> `optional` **now?**: () => `number`

Injectable clock.

#### Returns

`number`

***

### outbox

> **outbox**: [`OutboxStore`](OutboxStore.md)

The durable purchasing outbox (the commerce accounting authority).

***

### principal

> **principal**: `string`

The buyer principal issuing the statement.

***

### requestId

> **requestId**: `string`

***

### resolveAgreement

> **resolveAgreement**: [`UsageAgreementResolver`](../type-aliases/UsageAgreementResolver.md)

Resolve the completed dispatch to its agreement (undefined = skip).

***

### signer

> **signer**: `Signer`

The buyer's signature creation.

***

### usage

> **usage**: [`InferenceRecordedUsage`](InferenceRecordedUsage.md) \| `undefined`
