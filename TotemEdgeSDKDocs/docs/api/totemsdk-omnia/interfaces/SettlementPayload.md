[**@totemsdk/omnia**](../index.md)

***

[@totemsdk/omnia](../index.md) / SettlementPayload

# Interface: SettlementPayload

## Properties

### balances

> **balances**: `Record`\<[`partyId`](../type-aliases/partyId.md), `bigint`\>

***

### channelId

> **channelId**: `string`

***

### htlcOutputs

> **htlcOutputs**: `HTLCOutputRecord`[]

***

### sequence

> **sequence**: `number`

***

### settlementTxHex

> **settlementTxHex**: `string`

***

### txpowId?

> `optional` **txpowId?**: `string`

SHA3-256 TxPoW ID (hex) from mineTxPoW — populated when proposeSettlement is given a chainProvider.
