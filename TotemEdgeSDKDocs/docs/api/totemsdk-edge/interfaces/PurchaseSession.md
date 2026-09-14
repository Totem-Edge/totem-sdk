[**@totemsdk/edge**](../index.md)

***

[@totemsdk/edge](../index.md) / PurchaseSession

# Interface: PurchaseSession

A long-running resource exchange session.

## Properties

### agreement

> **agreement**: [`TradeAgreement`](TradeAgreement.md)

***

### id

> **id**: `string`

***

### status

> **status**: `"authorized"` \| `"active"` \| `"settling"` \| `"completed"` \| `"failed"` \| `"cancelled"`

## Methods

### close()

> **close**(): `Promise`\<[`EdgeReceipt`](EdgeReceipt.md)\>

#### Returns

`Promise`\<[`EdgeReceipt`](EdgeReceipt.md)\>

***

### spent()

> **spent**(): `Promise`\<\{ `amount`: `string`; `tokenId?`: `string`; \}\>

#### Returns

`Promise`\<\{ `amount`: `string`; `tokenId?`: `string`; \}\>

***

### usage()

> **usage**(): `Promise`\<[`UsageEvent`](UsageEvent.md)[]\>

#### Returns

`Promise`\<[`UsageEvent`](UsageEvent.md)[]\>
