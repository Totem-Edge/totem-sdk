[**@totemsdk/agent-policy**](../index.md)

***

[@totemsdk/agent-policy](../index.md) / reduceToCanonicalAction

# Function: reduceToCanonicalAction()

> **reduceToCanonicalAction**(`runId`, `principal`, `agentId`, `step`, `evidence`): [`CanonicalAgentAction`](../interfaces/CanonicalAgentAction.md)

Build a canonical action from a PREPARED operation. The wallet supplies the
effects; the autonomy policy authorizes exactly these.

## Parameters

### runId

`string`

### principal

`string`

### agentId

`string`

### step

[`PreparedStep`](../interfaces/PreparedStep.md)

### evidence

#### executionReceipt?

`unknown`

#### postconditionsVerified?

`boolean`

#### quoteTimestamp?

`number`

#### simulation?

`unknown`

## Returns

[`CanonicalAgentAction`](../interfaces/CanonicalAgentAction.md)
