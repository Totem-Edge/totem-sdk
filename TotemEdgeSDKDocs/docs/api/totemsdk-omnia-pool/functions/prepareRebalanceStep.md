[**@totemsdk/omnia-pool**](../index.md)

***

[@totemsdk/omnia-pool](../index.md) / prepareRebalanceStep

# Function: prepareRebalanceStep()

> **prepareRebalanceStep**(`runId`, `principal`, `agentId`, `step`): `object`

Reduce a prepared rebalance step to a canonical action and authorize it.
The wallet's tx draft is the source of truth for spends/fees/channel effects.

## Parameters

### runId

`string`

### principal

`string`

### agentId

`string`

### step

[`PreparedRebalanceStep`](../interfaces/PreparedRebalanceStep.md)

## Returns

`object`

### canonical

> **canonical**: `CanonicalAgentAction`

### prepared

> **prepared**: `PreparedStep`
