[**@totemsdk/edge**](../index.md)

***

[@totemsdk/edge](../index.md) / InferenceAccountingReconciliation

# Interface: InferenceAccountingReconciliation

## Properties

### accountedCount

> `readonly` **accountedCount**: `number`

***

### completedCount

> `readonly` **completedCount**: `number`

***

### completedUnaccounted

> `readonly` **completedUnaccounted**: readonly [`InferenceReadEvent`](../type-aliases/InferenceReadEvent.md)[]

Completed journal entries with no matching committed receipt.

***

### consistent

> `readonly` **consistent**: `boolean`

***

### interruptedAccounted

> `readonly` **interruptedAccounted**: readonly [`InferenceReadEvent`](../type-aliases/InferenceReadEvent.md)[]

Interrupted (outcome-unknown) entries that nevertheless have a committed
receipt — the serious case: work was charged for an execution whose
outcome is unknown. Surfaced, never silently accepted.

***

### interruptedCount

> `readonly` **interruptedCount**: `number`
