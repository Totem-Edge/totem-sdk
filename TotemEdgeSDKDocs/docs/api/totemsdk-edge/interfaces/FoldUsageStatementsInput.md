[**@totemsdk/edge**](../index.md)

***

[@totemsdk/edge](../index.md) / FoldUsageStatementsInput

# Interface: FoldUsageStatementsInput

## Properties

### journal

> **journal**: `Journal`\<[`InferenceAuditEvent`](../type-aliases/InferenceAuditEvent.md)\>

The inference usage journal (recovered for accounting).

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

The buyer principal issuing statements.

***

### resolveAgreement

> **resolveAgreement**: [`UsageAgreementResolver`](../type-aliases/UsageAgreementResolver.md)

Resolve a completed dispatch to the agreement it bills against.

***

### signer

> **signer**: `Signer`

The buyer's signature creation.
