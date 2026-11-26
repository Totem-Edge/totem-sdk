[**@totemsdk/tx-builder**](../index.md)

***

[@totemsdk/tx-builder](../index.md) / NodeAssemblyParams

# Interface: NodeAssemblyParams

## Properties

### basics?

> `optional` **basics?**: `boolean`

Run `txnbasics` (auto MMR proofs + scripts). Defaults to true.

***

### deleteAfter?

> `optional` **deleteAfter?**: `boolean`

Delete the custom txn after posting. Defaults to true.

***

### inputs

> **inputs**: [`NodeAssemblyInput`](NodeAssemblyInput.md)[]

***

### mine?

> `optional` **mine?**: `boolean`

Mine synchronously via `txnpost mine:true`. Defaults to true.

***

### outputs

> **outputs**: [`NodeAssemblyOutput`](NodeAssemblyOutput.md)[]

***

### signPublicKey?

> `optional` **signPublicKey?**: `string`

Optional node-wallet signing public key (txnsign).

***

### state?

> `optional` **state?**: [`NodeAssemblyState`](NodeAssemblyState.md)[]

***

### txnId?

> `optional` **txnId?**: `string`
