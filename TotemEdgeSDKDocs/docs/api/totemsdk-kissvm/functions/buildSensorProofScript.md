[**@totemsdk/kissvm**](../index.md)

***

[@totemsdk/kissvm](../index.md) / buildSensorProofScript

# Function: buildSensorProofScript()

> **buildSensorProofScript**(`config`): `string`

Build the KISSVM script for sensor proof verification.

The script:
  1. Verifies the device is authorized (PROOF → MAST)
  2. Verifies the WOTS signature over the reading
  3. Verifies the reading is within the max age window
  4. Verifies the output preserves the reading as state

## Parameters

### config

[`SensorProofConfig`](../interfaces/SensorProofConfig.md)

## Returns

`string`
