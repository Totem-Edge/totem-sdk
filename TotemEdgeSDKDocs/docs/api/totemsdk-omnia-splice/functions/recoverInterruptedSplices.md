[**@totemsdk/omnia-splice**](../index.md)

***

[@totemsdk/omnia-splice](../index.md) / recoverInterruptedSplices

# Function: recoverInterruptedSplices()

> **recoverInterruptedSplices**(`store`, `chain`, `observe`, `broadcast`): `Promise`\<[`SpliceRecoveryResult`](../interfaces/SpliceRecoveryResult.md)[]\>

Reconcile interrupted broadcasts.

- If the successor is already visible, record its coin id and clear the
  pending entry.
- Otherwise rebroadcast the exact TxPoW (idempotent at the node by txpow id)
  and leave the entry pending for the next pass.

## Parameters

### store

[`PendingSpliceStore`](../interfaces/PendingSpliceStore.md)

### chain

[`SpliceChainObserver`](../interfaces/SpliceChainObserver.md)

### observe

`Omit`\<[`SpliceSuccessorOptions`](../interfaces/SpliceSuccessorOptions.md), `"now"`\>

### broadcast

(`txHex`) => `Promise`\<\{ `success?`: `boolean`; `txpowid?`: `string`; \}\>

## Returns

`Promise`\<[`SpliceRecoveryResult`](../interfaces/SpliceRecoveryResult.md)[]\>
