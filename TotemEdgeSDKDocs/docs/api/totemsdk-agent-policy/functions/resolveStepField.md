[**@totemsdk/agent-policy**](../index.md)

***

[@totemsdk/agent-policy](../index.md) / resolveStepField

# Function: resolveStepField()

> **resolveStepField**(`step`, `field`): `unknown`

Resolve a trusted step field for mandate matching. Supports top-level step
fields (`runId`, `stepId`, `sequence`, `parentStepIds`, `workflow`, `target`)
and dotted paths into the action constraints (`payload.*`, `previousReceiptId`,
`cumulativeAmount`, `failureCount`).

## Parameters

### step

[`AgentStep`](../interfaces/AgentStep.md)

### field

`string`

## Returns

`unknown`
