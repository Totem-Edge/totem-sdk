[**@totemsdk/edge-mqtt**](../index.md)

***

[@totemsdk/edge-mqtt](../index.md) / MqttCommandHandlerConfig

# Interface: MqttCommandHandlerConfig

## Properties

### client

> **client**: [`MqttClientPort`](MqttClientPort.md)

***

### commandTopic?

> `optional` **commandTopic?**: `string`

***

### executor?

> `optional` **executor?**: [`MqttCommandExecutor`](MqttCommandExecutor.md)

***

### maxCommandAgeMs?

> `optional` **maxCommandAgeMs?**: `number`

Maximum age of a command in milliseconds (default 60_000).

***

### metadata?

> `optional` **metadata?**: `Record`\<`string`, `unknown`\>

***

### receiptTopic?

> `optional` **receiptTopic?**: `string`

***

### runtime

> **runtime**: `EdgeRuntime`

***

### verifyCommandSignature?

> `optional` **verifyCommandSignature?**: (`envelope`) => `Promise`\<`boolean`\>

Function to verify a command signature.

#### Parameters

##### envelope

`SignedCommandEnvelope`

#### Returns

`Promise`\<`boolean`\>
