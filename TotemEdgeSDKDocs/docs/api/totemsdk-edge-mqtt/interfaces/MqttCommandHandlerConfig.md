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

### replayStore?

> `optional` **replayStore?**: `ReplayLedgerStore`

Durable store for the replay ledger. When provided, processed command IDs
survive restarts (RFC-007 G4); otherwise an in-memory freshness window is
used.

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
