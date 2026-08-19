[**@totemsdk/agent-policy**](../index.md)

***

[@totemsdk/agent-policy](../index.md) / AmountCapConfig

# Interface: AmountCapConfig

AmountCapPolicy — caps the total amount of MIN or tokens an agent can
spend per transaction and/or per day.

Amounts are compared as BigInt. Only proposals with a numeric `amount`
are subject to caps — proposals without an amount pass through.

The daily cap uses a fixed 24-hour window per principal and token.

## Lifecycle contract

`evaluate()` is read-only and never mutates state. Quota is consumed only
through the reservation lifecycle:

  reserve(proposal) → commit(proposal.id)   // on success
                     → release(proposal.id) // on failure

Operation IDs are bound to a canonical digest of the full proposal. A retry
that reuses an operation ID with different contents is rejected. The
committed state is irreversible: `release` only refunds a `reserved`
operation and is a no-op on `committed` operations.

## Example

```ts
// Max 500 MIN per transaction, 10_000 MIN per day
const amountCap = new AmountCapPolicy({ perTx: '500', perDay: '10000' });
```

## Properties

### perDay?

> `optional` **perDay?**: `string`

Maximum total amount per fixed 24-hour window.

***

### perTx?

> `optional` **perTx?**: `string`

Maximum amount per single transaction.
