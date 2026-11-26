[**@totemsdk/edge-gnss**](../index.md)

***

[@totemsdk/edge-gnss](../index.md) / parseNmeaFix

# Function: parseNmeaFix()

> **parseNmeaFix**(`lines`, `options?`): [`GnssFix`](../interfaces/GnssFix.md) \| `null`

Merge GGA/RMC/GSA sentences into one fix. Returns null when no position is
present or the receiver reports no fix.

## Parameters

### lines

`string`[]

### options?

[`NmeaFixOptions`](../interfaces/NmeaFixOptions.md) = `{}`

## Returns

[`GnssFix`](../interfaces/GnssFix.md) \| `null`
