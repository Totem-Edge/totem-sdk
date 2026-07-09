[**@totemsdk/node**](../index.md)

***

[@totemsdk/node](../index.md) / precomputeTransactionCoinID

# Function: precomputeTransactionCoinID()

> **precomputeTransactionCoinID**(`inputs`, `outputs`): `void`

Precompute output coin IDs before computing the transaction digest.

CRITICAL: Java's txnsign command calls TxPoWGenerator.precomputeTransactionCoinID(txn)
BEFORE calculateTransactionID(). This means the transaction digest that gets signed
includes the PRECOMPUTED output coin IDs, not the placeholder 0x00.

Formula: outputCoinID = SHA3-256( writeMiniData(input[0].coinID) || writeMiniNumber(outputIndex) )
This matches Java's Crypto.hashObjects(baseCoinID, new MiniNumber(outputNum))

Without this, the wallet signs a different digest than what the node verifies against,
causing allsignaturesvalid=false on every transaction.

## Parameters

### inputs

`object`[]

Transaction inputs array, each must have a coinId (Uint8Array)

### outputs

`object`[]

Transaction outputs array, each will have its coinId mutated in-place

## Returns

`void`
