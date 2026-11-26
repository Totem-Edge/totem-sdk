[**@totemsdk/edge-ocpp**](../index.md)

***

[@totemsdk/edge-ocpp](../index.md) / OcppGatewayConfig

# Interface: OcppGatewayConfig

## Properties

### bootNotification?

> `optional` **bootNotification?**: `Record`\<`string`, `unknown`\>

***

### bootOnStart?

> `optional` **bootOnStart?**: `boolean`

Send BootNotification during start. Default true.

***

### callTimeoutMs?

> `optional` **callTimeoutMs?**: `number`

***

### chargePointId

> **chargePointId**: `string`

***

### heartbeatIntervalMs?

> `optional` **heartbeatIntervalMs?**: `number`

Heartbeat interval; 0 disables automatic heartbeats. Default 30s.

***

### protocols?

> `optional` **protocols?**: `string`[]

***

### runtime

> **runtime**: `EdgeRuntime`

***

### transport

> **transport**: [`OcppTransportPort`](OcppTransportPort.md)

***

### url

> **url**: `string`

***

### version?

> `optional` **version?**: [`OcppVersion`](../type-aliases/OcppVersion.md)
