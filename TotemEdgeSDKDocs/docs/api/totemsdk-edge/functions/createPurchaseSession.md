[**@totemsdk/edge**](../index.md)

***

[@totemsdk/edge](../index.md) / createPurchaseSession

# Function: createPurchaseSession()

> **createPurchaseSession**(`opts`): [`PurchaseSession`](../interfaces/PurchaseSession.md)

Create a PurchaseSession backed by an in-memory usage event list.
Production deployments should source usage from a resource adapter or
verifiable meter — not from arbitrary callers.

## Parameters

### opts

[`SessionOptions`](../interfaces/SessionOptions.md)

## Returns

[`PurchaseSession`](../interfaces/PurchaseSession.md)
