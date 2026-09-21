[**@totemsdk/edge**](../index.md)

***

[@totemsdk/edge](../index.md) / foldCompletedDispatch

# Function: foldCompletedDispatch()

> **foldCompletedDispatch**(`input`): `Promise`\<\{ `folded`: `boolean`; \}\>

Fold a single completed dispatch (the live-completion path, used by the
accounted port's `afterCompleted` hook). Returns `{ folded: true }` when a
statement was enqueued, `{ folded: false }` when the dispatch is not
purchase-bound or the agreement cannot be resolved.

## Parameters

### input

[`FoldCompletedDispatchInput`](../interfaces/FoldCompletedDispatchInput.md)

## Returns

`Promise`\<\{ `folded`: `boolean`; \}\>
