[**@totemsdk/edge**](../index.md)

***

[@totemsdk/edge](../index.md) / FoldUsageStatementsReport

# Interface: FoldUsageStatementsReport

## Properties

### dropped

> **dropped**: `number`

Completed purchase-attributable dispatches with no resolvable agreement.

***

### folded

> **folded**: `number`

Completed purchase-bound dispatches folded into the outbox.

***

### interrupted

> **interrupted**: `number`

Recovered interrupted runs — never folded, never billed.

***

### skippedNotPurchaseBound

> **skippedNotPurchaseBound**: `number`

Completed dispatches with no purchase agreement context at all.
