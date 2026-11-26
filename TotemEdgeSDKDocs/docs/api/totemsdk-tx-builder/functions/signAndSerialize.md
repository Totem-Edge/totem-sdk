[**@totemsdk/tx-builder**](../index.md)

***

[@totemsdk/tx-builder](../index.md) / signAndSerialize

# Function: signAndSerialize()

> **signAndSerialize**(`params`, `signer`, `txId`): `Promise`\<[`SignedTransaction`](../interfaces/SignedTransaction.md)\>

Build the transaction, sign its digest, assemble the witness, and serialize a
TxnRow for `txnimport`/broadcast.

## Parameters

### params

[`EnhancedBuildParams`](../interfaces/EnhancedBuildParams.md)

### signer

[`TransactionSigner`](../interfaces/TransactionSigner.md)

### txId

`string`

## Returns

`Promise`\<[`SignedTransaction`](../interfaces/SignedTransaction.md)\>
