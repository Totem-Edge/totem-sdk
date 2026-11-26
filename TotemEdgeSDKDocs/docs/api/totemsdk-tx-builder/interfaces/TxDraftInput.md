[**@totemsdk/tx-builder**](../index.md)

***

[@totemsdk/tx-builder](../index.md) / TxDraftInput

# Interface: TxDraftInput

## Properties

### address

> **address**: `string`

***

### amount

> **amount**: `bigint`

***

### coinId

> **coinId**: `string`

***

### mmrEntry?

> `optional` **mmrEntry?**: `bigint`

Real MMR entry number from the input coin proof; must match txnmine.

***

### scriptHex?

> `optional` **scriptHex?**: `string`

***

### stateVariables?

> `optional` **stateVariables?**: `StateValue`[]

***

### storeState?

> `optional` **storeState?**: `boolean`

Chain state flag of the input coin (needed for txnmine script checks).

***

### tokenId

> **tokenId**: `string`
