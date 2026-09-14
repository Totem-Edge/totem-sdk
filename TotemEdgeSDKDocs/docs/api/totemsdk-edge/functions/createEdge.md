[**@totemsdk/edge**](../index.md)

***

[@totemsdk/edge](../index.md) / createEdge

# Function: createEdge()

> **createEdge**(`opts`): [`EdgeCommerceRuntime`](../interfaces/EdgeCommerceRuntime.md)

Create a runtime-level machine commerce facade.

Optional ports degrade gracefully:
  - no durable store → explicit in-memory/dev mode
  - no negotiation transport → local/programmatic negotiation only
  - no Minima relay → commerce still works
  - no work admission → work-disabled policy only

## Parameters

### opts

[`CreateEdgeOptions`](../interfaces/CreateEdgeOptions.md)

## Returns

[`EdgeCommerceRuntime`](../interfaces/EdgeCommerceRuntime.md)
