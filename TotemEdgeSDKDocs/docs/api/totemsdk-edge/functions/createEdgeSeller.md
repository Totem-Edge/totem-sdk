[**@totemsdk/edge**](../index.md)

***

[@totemsdk/edge](../index.md) / createEdgeSeller

# Function: createEdgeSeller()

> **createEdgeSeller**(`opts`): [`EdgeSeller`](../interfaces/EdgeSeller.md)

Create a seller-side negotiation service.

The returned object is a lightweight wrapper around the shared
NegotiationEngine plus an inbound transport handler. All durable state
lives in the injected stores.

## Parameters

### opts

[`SellerServiceOptions`](../interfaces/SellerServiceOptions.md)

## Returns

[`EdgeSeller`](../interfaces/EdgeSeller.md)
