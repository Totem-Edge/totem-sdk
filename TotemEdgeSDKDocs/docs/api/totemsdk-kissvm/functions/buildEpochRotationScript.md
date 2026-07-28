[**@totemsdk/kissvm**](../index.md)

***

[@totemsdk/kissvm](../index.md) / buildEpochRotationScript

# Function: buildEpochRotationScript()

> **buildEpochRotationScript**(`config`): `string`

Build an epoch-based controller rotation script.
The current controller must sign, and the new epoch must be strictly greater.
Old credentials cannot be replayed once the epoch advances.

## Parameters

### config

[`EpochRotationConfig`](../interfaces/EpochRotationConfig.md)

## Returns

`string`
