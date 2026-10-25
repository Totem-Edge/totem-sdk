[**@totemsdk/kissvm**](../index.md)

***

[@totemsdk/kissvm](../index.md) / TxPoWValidationConfig

# Interface: TxPoWValidationConfig

## Properties

### attestorPk

> **attestorPk**: `string`

Fixed attestor permitted to assert the TxPoW metadata (I1). These ports are
transaction state, not network-observed TxPoW measurements, so the script is
an *attested metadata constraint* — only the attestor may assert it.

***

### magicPort

> **magicPort**: `number`

***

### maxKISSVMOps

> **maxKISSVMOps**: `bigint`

***

### maxTxPoWSize

> **maxTxPoWSize**: `bigint`

***

### minTxPoWWork

> **minTxPoWWork**: `bigint`

***

### opsPort

> **opsPort**: `number`

***

### workPort

> **workPort**: `number`
