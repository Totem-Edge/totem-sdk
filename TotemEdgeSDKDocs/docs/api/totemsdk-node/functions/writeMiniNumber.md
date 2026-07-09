[**@totemsdk/node**](../index.md)

***

[@totemsdk/node](../index.md) / writeMiniNumber

# Function: writeMiniNumber()

> **writeMiniNumber**(`value`, `scale?`): `Uint8Array`

Encode a MiniNumber per Java MiniNumber.writeDataStream()

Format:
  1 byte: scale (number of decimal places, signed)
  1 byte: length of unscaled BigInteger data
  N bytes: unscaled BigInteger in two's complement

CRITICAL: Uses 1-byte length, NOT 4-byte like MiniData!

## Parameters

### value

`bigint`

The unscaled BigInt value

### scale?

`number`

The scale (decimal places), default 0

## Returns

`Uint8Array`
