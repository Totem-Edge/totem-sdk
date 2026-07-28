[**@totemsdk/edge-mqtt**](../index.md)

***

[@totemsdk/edge-mqtt](../index.md) / MqttQueuedEvent

# Interface: MqttQueuedEvent

## Properties

### attempts

> **attempts**: `number`

***

### createdAt

> **createdAt**: `number`

***

### id

> **id**: `string`

***

### metadata?

> `optional` **metadata?**: `Record`\<`string`, `unknown`\>

***

### nextAttemptAt?

> `optional` **nextAttemptAt?**: `number`

***

### payload

> **payload**: `string` \| `Uint8Array`\<`ArrayBufferLike`\>

***

### topic

> **topic**: `string`

***

### type

> **type**: `"proof"` \| `"receipt"` \| `"status"` \| `"message"` \| `"error"`
