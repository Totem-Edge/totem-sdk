[**@totemsdk/edge-mavlink**](../index.md)

***

[@totemsdk/edge-mavlink](../index.md) / MavlinkGatewayConfig

# Interface: MavlinkGatewayConfig

## Properties

### commandTimeoutMs?

> `optional` **commandTimeoutMs?**: `number`

***

### componentId

> **componentId**: `number`

***

### heartbeatIntervalMs?

> `optional` **heartbeatIntervalMs?**: `number`

Heartbeat interval in ms; 0 disables automatic heartbeats. Default 1000.

***

### runtime

> **runtime**: `EdgeRuntime`

***

### systemId

> **systemId**: `number`

***

### targetComponentId?

> `optional` **targetComponentId?**: `number`

***

### targetSystemId?

> `optional` **targetSystemId?**: `number`

Target system/component for commands. Defaults to the gateway IDs.

***

### transport

> **transport**: [`MavlinkTransportPort`](MavlinkTransportPort.md)
