[**@totemsdk/qvac**](../index.md)

***

[@totemsdk/qvac](../index.md) / QvacSystemOps

# Interface: QvacSystemOps

## Properties

### cancel

> **cancel**: `QvacOp`\<\{ `requestId?`: `string`; \}, `unknown`\>

***

### close

> **close**: `QvacOp`\<`Record`\<`string`, `never`\>, `unknown`\>

***

### getSystemResources

> **getSystemResources**: `QvacOp`\<`Record`\<`string`, `never`\>, \{ `cpu?`: `string`; `gpu?`: `string`; \}\>

***

### heartbeat

> **heartbeat**: `QvacOp`\<`Record`\<`string`, `never`\>, \{ `status?`: `string`; \}\>

***

### loggingStream

> **loggingStream**: `QvacOp`\<`Record`\<`string`, `never`\>, `unknown`\>

***

### subscribeServerLogs

> **subscribeServerLogs**: `QvacOp`\<`Record`\<`string`, `never`\>, `unknown`\>
