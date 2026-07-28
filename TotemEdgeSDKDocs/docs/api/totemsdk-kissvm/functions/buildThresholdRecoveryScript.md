[**@totemsdk/kissvm**](../index.md)

***

[@totemsdk/kissvm](../index.md) / buildThresholdRecoveryScript

# Function: buildThresholdRecoveryScript()

> **buildThresholdRecoveryScript**(`config`): `string`

Build a threshold recovery script requiring M-of-N custodian signatures.
The recovery activates after a mandatory delay, during which the current
controller or another guardian can veto.

## Parameters

### config

[`ThresholdRecoveryConfig`](../interfaces/ThresholdRecoveryConfig.md)

## Returns

`string`
