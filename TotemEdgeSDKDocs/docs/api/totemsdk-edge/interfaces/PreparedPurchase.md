[**@totemsdk/edge**](../index.md)

***

[@totemsdk/edge](../index.md) / PreparedPurchase

# Interface: PreparedPurchase

RFC-019: the result of discovery/negotiation/agreement preparation, BEFORE
any economic commitment. A governed action authorizes the canonical effects
of this prepared purchase, then `executePrepared()` performs exactly it.

## Properties

### agreement

> **agreement**: [`TradeAgreement`](TradeAgreement.md)

***

### intent

> **intent**: [`PurchaseIntent`](PurchaseIntent.md)

***

### options

> **options**: [`BuyOptions`](BuyOptions.md)

***

### purchaseId

> **purchaseId**: `string`

***

### record

> **record**: [`PurchaseRecord`](PurchaseRecord.md)
