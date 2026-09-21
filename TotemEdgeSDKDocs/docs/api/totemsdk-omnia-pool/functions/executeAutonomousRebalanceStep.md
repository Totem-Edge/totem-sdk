[**@totemsdk/omnia-pool**](../index.md)

***

[@totemsdk/omnia-pool](../index.md) / executeAutonomousRebalanceStep

# Function: executeAutonomousRebalanceStep()

> **executeAutonomousRebalanceStep**(`options`, `step`): `Promise`\<[`AutonomousRebalanceResult`](../interfaces/AutonomousRebalanceResult.md)\>

Execute one autonomous rebalance step end-to-end:
prepare → reduce → authorize → execute → commit / abort.

On approval the step is executed against the live port (channel update and/or
pool allocation), then the reservation is committed with the tx digest as
the execution proof. On failure the reservation is aborted and the error
rethrown so the caller can apply its failure budget.

## Parameters

### options

[`AutonomousRebalanceOptions`](../interfaces/AutonomousRebalanceOptions.md)

### step

[`PreparedRebalanceStep`](../interfaces/PreparedRebalanceStep.md)

## Returns

`Promise`\<[`AutonomousRebalanceResult`](../interfaces/AutonomousRebalanceResult.md)\>
