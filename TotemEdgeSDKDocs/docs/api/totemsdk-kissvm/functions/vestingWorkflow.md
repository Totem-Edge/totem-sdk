[**@totemsdk/kissvm**](../index.md)

***

[@totemsdk/kissvm](../index.md) / vestingWorkflow

# Function: vestingWorkflow()

> **vestingWorkflow**(`startPort`, `totalPort`, `claimedPort`, `beneficiaryPk`): [`PrevStateWorkflow`](../interfaces/PrevStateWorkflow.md)

Generate a KISSVM script for a vesting schedule.

## Parameters

### startPort

`number`

STATE port for vesting start block.

### totalPort

`number`

STATE port for total vested amount.

### claimedPort

`number`

STATE port for previously claimed amount.

### beneficiaryPk

`string`

Public key of the beneficiary.

## Returns

[`PrevStateWorkflow`](../interfaces/PrevStateWorkflow.md)
