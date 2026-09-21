[**@totemsdk/qvac**](../index.md)

***

[@totemsdk/qvac](../index.md) / QvacSystemOps

# Interface: QvacSystemOps

## Properties

### cancel

> **cancel**: `QvacOp`\<[`CancelClientInput`](../type-aliases/CancelClientInput.md), `void`\>

***

### close

> **close**: `QvacOp`\<`Record`\<`string`, `never`\>, `void`\>

***

### getSystemResources

> **getSystemResources**: `QvacOp`\<[`GetSystemResourcesInput`](GetSystemResourcesInput.md), [`SystemResources`](SystemResources.md)\>

***

### heartbeat

> **heartbeat**: `QvacOp`\<`Record`\<`string`, `never`\>, [`HeartbeatResponse`](HeartbeatResponse.md)\>

***

### loggingStream

> **loggingStream**: `QvacOp`\<[`LoggingParams`](LoggingParams.md), `AsyncGenerator`\<[`LoggingStreamResponse`](LoggingStreamResponse.md), `any`, `any`\>\>

***

### subscribeServerLogs

> **subscribeServerLogs**: (`handler`) => `Promise`\<`IntelligenceOutcome`\<\{ `unsubscribe`: () => `void`; \}\>\>

Real upstream signature: `subscribeServerLogs(handler)` returns an
unsubscribe function; the adapter surfaces it as `{ unsubscribe }`.

#### Parameters

##### handler

[`ServerLogHandler`](ServerLogHandler.md)

#### Returns

`Promise`\<`IntelligenceOutcome`\<\{ `unsubscribe`: () => `void`; \}\>\>
