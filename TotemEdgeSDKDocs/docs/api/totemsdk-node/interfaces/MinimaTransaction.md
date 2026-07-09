[**@totemsdk/node**](../index.md)

***

[@totemsdk/node](../index.md) / MinimaTransaction

# Interface: MinimaTransaction

Transaction Serialization & Digest Computation

Port of the extension's MinimaTransactionBuilder serialization logic
to the SDK core for full parity with the Totem wallet extension.

Matches Minima Java's Transaction.writeDataStream() and Coin.writeDataStream() exactly.

CRITICAL: Before computing the transaction digest for signing, you MUST call
precomputeTransactionCoinID() to set output coin IDs. Without this, the signed
digest won't match what the Minima node verifies, causing allsignaturesvalid=false.

## Properties

### inputs

> **inputs**: [`MinimaCoin`](MinimaCoin.md)[]

***

### linkHash

> **linkHash**: `Uint8Array`

***

### outputs

> **outputs**: [`MinimaCoin`](MinimaCoin.md)[]

***

### state

> **state**: [`StateVariable`](StateVariable.md)[]
