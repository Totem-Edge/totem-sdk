[**@totemsdk/edge-adapters**](../index.md)

***

[@totemsdk/edge-adapters](../index.md) / PurchasePaymentClaimRecord

# Type Alias: PurchasePaymentClaimRecord

> **PurchasePaymentClaimRecord** = \{ `claimedAt`: `number`; `phase`: `"pending"`; \} \| \{ `completedAt`: `number`; `phase`: `"completed"`; `result`: `EdgeOperationResult`\<`PaymentResult`\>; \}

Idempotency claim record. `pending` is written atomically before the port
call; `completed` records the outcome. A `pending` key is never re-claimed
automatically — that is the double-pay guard.
