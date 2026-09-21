[**@totemsdk/qvac**](../index.md)

***

[@totemsdk/qvac](../index.md) / CompletionRun

# Interface: CompletionRun

## Properties

### events

> **events**: `AsyncIterable`\<[`CompletionEvent`](../type-aliases/CompletionEvent.md)\>

***

### final

> **final**: `Promise`\<[`CompletionFinal`](CompletionFinal.md)\>

***

### requestId

> **requestId**: `string`

***

### stats

> **stats**: `Promise`\<[`CompletionStats`](CompletionStats.md) \| `undefined`\>

***

### text

> **text**: `Promise`\<`string`\>

***

### tokenStream

> **tokenStream**: `AsyncGenerator`\<`string`\>

***

### toolCalls

> **toolCalls**: `Promise`\<`ToolCallWithCall`[]\>

***

### toolCallStream

> **toolCallStream**: `AsyncGenerator`\<`ToolCallEvent`\>
