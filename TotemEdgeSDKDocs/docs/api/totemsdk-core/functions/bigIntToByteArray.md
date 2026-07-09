[**@totemsdk/core**](../index.md)

***

[@totemsdk/core](../index.md) / bigIntToByteArray

# Function: bigIntToByteArray()

> **bigIntToByteArray**(`value`): `Uint8Array`

Convert a BigInt to Java BigInteger.toByteArray() format.

Java BigInteger uses two's complement:
  - Zero → [0x00]
  - Positive with high bit set → leading 0x00 byte

## Parameters

### value

`bigint`

The BigInt value (must be non-negative)

## Returns

`Uint8Array`

Uint8Array in two's complement format
