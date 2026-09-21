[**@totemsdk/proofgraph**](../index.md)

***

[@totemsdk/proofgraph](../index.md) / DurableProofGraphStore

# Type Alias: DurableProofGraphStore

> **DurableProofGraphStore** = [`ProofGraphStoragePort`](../interfaces/ProofGraphStoragePort.md) & `object`

## Type Declaration

### latest()

> **latest**(): `Promise`\<[`ProofGraph`](../interfaces/ProofGraph.md) \| `null`\>

Load the most-recent saved graph (the head).

#### Returns

`Promise`\<[`ProofGraph`](../interfaces/ProofGraph.md) \| `null`\>

### listGraphIds()

> **listGraphIds**(): `Promise`\<`string`[]\>

List all persisted graphIds.

#### Returns

`Promise`\<`string`[]\>

### recover()

> **recover**(): `Promise`\<[`ProofGraphRecoveryReport`](../interfaces/ProofGraphRecoveryReport.md)\>

Reconcile head + index after a crash/interruption.

#### Returns

`Promise`\<[`ProofGraphRecoveryReport`](../interfaces/ProofGraphRecoveryReport.md)\>
