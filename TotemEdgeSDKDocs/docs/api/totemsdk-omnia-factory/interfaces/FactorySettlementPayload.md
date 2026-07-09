[**@totemsdk/omnia-factory**](../index.md)

***

[@totemsdk/omnia-factory](../index.md) / FactorySettlementPayload

# Interface: FactorySettlementPayload

## Properties

### factoryId

> **factoryId**: `string`

***

### finalAllocations

> **finalAllocations**: `Record`\<`string`, `bigint`\>

***

### sequence

> **sequence**: `number`

***

### settlementTxHex

> **settlementTxHex**: `string`

Serialized settlement OmniaTxDraft (hex) — built by `serializeTxDraft` from @totemsdk/omnia.

***

### txpowId?

> `optional` **txpowId?**: `string`

SHA3-256 TxPoW ID (hex) — populated when closeFactory is given a chainProvider.
