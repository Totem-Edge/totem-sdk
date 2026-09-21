[**@totemsdk/qvac**](../index.md)

***

[@totemsdk/qvac](../index.md) / QvacCallResult

# Interface: QvacCallResult

Result of a single QVAC invocation, normalised by the adapter.

`upstreamRequestId` is the QVAC-side request id captured from the decorated
promise / run object the SDK returned (see `requestId` on CompletionRun,
embed/loadModel/transcribe decorated promises, translate results, …). The
provider records it so a later `cancel(requestId)` can be forwarded upstream
as `sdk.cancel({ requestId })` — targeted cancellation instead of a bare
local AbortSignal.

## Properties

### data

> `readonly` **data**: `unknown`

***

### upstreamRequestId?

> `readonly` `optional` **upstreamRequestId?**: `string`

***

### usage?

> `readonly` `optional` **usage?**: `Partial`\<`IntelligenceUsage`\>
