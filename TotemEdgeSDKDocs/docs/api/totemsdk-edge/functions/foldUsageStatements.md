[**@totemsdk/edge**](../index.md)

***

[@totemsdk/edge](../index.md) / foldUsageStatements

# Function: foldUsageStatements()

> **foldUsageStatements**(`input`): `Promise`\<[`FoldUsageStatementsReport`](../interfaces/FoldUsageStatementsReport.md)\>

Recover the journal and fold every completed purchase-bound dispatch into
the purchasing outbox as a signed usage statement.

This is the authoritative reconciliation pass: it is also safe to run after
a crash that interrupted a dispatch or the previous fold attempt — entries
already enqueued re-enqueue the SAME messageId (no duplication), and
`interrupted` runs are never billed.

## Parameters

### input

[`FoldUsageStatementsInput`](../interfaces/FoldUsageStatementsInput.md)

## Returns

`Promise`\<[`FoldUsageStatementsReport`](../interfaces/FoldUsageStatementsReport.md)\>
