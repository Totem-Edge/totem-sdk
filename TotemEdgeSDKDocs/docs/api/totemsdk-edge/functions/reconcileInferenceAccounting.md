[**@totemsdk/edge**](../index.md)

***

[@totemsdk/edge](../index.md) / reconcileInferenceAccounting

# Function: reconcileInferenceAccounting()

> **reconcileInferenceAccounting**(`input`): `Promise`\<[`InferenceAccountingReconciliation`](../interfaces/InferenceAccountingReconciliation.md)\>

Read-only cross-check between the inference journal and the owning
accounting authority for one mandate.

Matches journal events to committed receipts by `(runId, stepId)`. A
completed entry with no committed receipt is `completedUnaccounted` (the
host should resolve — e.g. aborted prematurely or the account lags). An
interrupted entry that IS in the committed set is `interruptedAccounted`,
which must never be treated as a normal completion — the account has
consumption the journal cannot corroborate as `completed`. The caller
decides the corrective action; this function never writes.

## Parameters

### input

[`ReconcileInferenceAccountingOptions`](../interfaces/ReconcileInferenceAccountingOptions.md)

## Returns

`Promise`\<[`InferenceAccountingReconciliation`](../interfaces/InferenceAccountingReconciliation.md)\>
