[**@totemsdk/proofgraph**](../index.md)

***

[@totemsdk/proofgraph](../index.md) / addReceiptLike

# Function: addReceiptLike()

> **addReceiptLike**(`graph`, `receipt`): [`ProofGraph`](../interfaces/ProofGraph.md)

Add a receipt-like node (payment, subscription, claim receipt) to the graph.
If receipt.proofId is set, adds a 'supports' edge from the receipt to that proof.

## Parameters

### graph

[`ProofGraph`](../interfaces/ProofGraph.md)

### receipt

[`ReceiptLikeInput`](../interfaces/ReceiptLikeInput.md)

## Returns

[`ProofGraph`](../interfaces/ProofGraph.md)
