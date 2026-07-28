[**@totemsdk/edge-mqtt**](../index.md)

***

[@totemsdk/edge-mqtt](../index.md) / MqttCreditGateConfig

# Interface: MqttCreditGateConfig

## Properties

### client

> **client**: [`MqttClientPort`](MqttClientPort.md)

***

### deviceId

> **deviceId**: `string`

***

### getUsage?

> `optional` **getUsage?**: () => `string`

Optional hook to read accumulated unpaid usage from an external source
(e.g. a linked MqttUsageMeter). When provided, this overrides the gate's
internal usage counter. Useful when usage and credit are tracked separately.

#### Returns

`string`

***

### mode?

> `optional` **mode?**: `"block"` \| `"warn"` \| `"shutdown"`

***

### runtime

> **runtime**: `EdgeRuntime`

***

### shutdownTopic?

> `optional` **shutdownTopic?**: `string`

***

### statusTopic?

> `optional` **statusTopic?**: `string`

***

### unpaidLimit?

> `optional` **unpaidLimit?**: `string`
