[**@totemsdk/liquidity-bond**](../index.md)

***

[@totemsdk/liquidity-bond](../index.md) / PayoutSettlementEvidence

# Interface: PayoutSettlementEvidence

A finality claim for a payout. This is evidence, not proof: it is only
trustworthy once a `PayoutSettlementVerifier` has checked it against the
chain or the channel/factory.

## Properties

### depth?

> `optional` **depth?**: `number`

Observed confirmation depth for `confirmed` evidence.

***

### evidenceRef

> **evidenceRef**: `string`

Reference into the evidence source (indexer id, channel settlement id, ...).

***

### status

> **status**: [`PayoutSettlementStatus`](../type-aliases/PayoutSettlementStatus.md)

***

### txpowId?

> `optional` **txpowId?**: `string`

On-chain transaction id when the evidence is a confirmed transaction.
