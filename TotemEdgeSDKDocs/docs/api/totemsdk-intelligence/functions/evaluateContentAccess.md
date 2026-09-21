[**@totemsdk/intelligence**](../index.md)

***

[@totemsdk/intelligence](../index.md) / evaluateContentAccess

# Function: evaluateContentAccess()

> **evaluateContentAccess**(`policy`, `domain`, `op`, `params`, `context`): [`ContentAccessDecision`](../interfaces/ContentAccessDecision.md)

Decide whether a RAG operation may proceed for the calling principal.

Purely a policy function — no provider interaction. Returns the effective
params (with `workspaceId` rewritten when the caller left it unset and has
exactly one entitled workspace, so the provider never sees an un-scoped
retrieval) or a denial.

## Parameters

### policy

[`ContentAccessPolicy`](../interfaces/ContentAccessPolicy.md)

### domain

`string`

### op

`string`

### params

`Record`\<`string`, `unknown`\>

### context

[`IntelligenceContext`](../interfaces/IntelligenceContext.md) \| `undefined`

## Returns

[`ContentAccessDecision`](../interfaces/ContentAccessDecision.md)
