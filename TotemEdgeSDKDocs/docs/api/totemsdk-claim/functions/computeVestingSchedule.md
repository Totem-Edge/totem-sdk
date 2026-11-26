[**@totemsdk/claim**](../index.md)

***

[@totemsdk/claim](../index.md) / computeVestingSchedule

# Function: computeVestingSchedule()

> **computeVestingSchedule**(`policy`, `block`, `totalAmount?`): [`VestingScheduleResult`](../type-aliases/VestingScheduleResult.md)

Compute the vested amount and the schedule bounds at `block`.

`totalAmount` may come from the policy or from the claim context (the VTXO
amount, for example). Evaluation fails closed when neither is available.

## Parameters

### policy

[`VestingPolicyShape`](../interfaces/VestingPolicyShape.md)

### block

`number`

### totalAmount?

`bigint`

## Returns

[`VestingScheduleResult`](../type-aliases/VestingScheduleResult.md)
