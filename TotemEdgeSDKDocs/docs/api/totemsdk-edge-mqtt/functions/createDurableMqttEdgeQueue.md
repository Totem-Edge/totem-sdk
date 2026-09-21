[**@totemsdk/edge-mqtt**](../index.md)

***

[@totemsdk/edge-mqtt](../index.md) / createDurableMqttEdgeQueue

# Function: createDurableMqttEdgeQueue()

> **createDurableMqttEdgeQueue**(`adapter`, `options?`): [`DurableMqttEdgeQueue`](../type-aliases/DurableMqttEdgeQueue.md)

Create a durable, at-least-once MQTT offline queue over a CAS-capable
adapter (`CasStore.conditionalUpdate`).

After a restart, call `recoverInFlight()` before `dequeue()` to re-deliver
events that were claimed but never acked (the RFC-007 crash window).
Pending events are eligible for delivery again automatically on restart.

## Parameters

### adapter

`StorageAdapter`

### options?

[`DurableMqttEdgeQueueOptions`](../interfaces/DurableMqttEdgeQueueOptions.md) = `{}`

## Returns

[`DurableMqttEdgeQueue`](../type-aliases/DurableMqttEdgeQueue.md)
