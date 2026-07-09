[**@totemsdk/node**](../index.md)

***

[@totemsdk/node](../index.md) / toWinternitzDigits

# Function: toWinternitzDigits()

> **toWinternitzDigits**(`hash32`, `ps?`): `object`

Convert message hash to Winternitz digits with checksum

For w=8 (8 bits per digit), since 8 % 8 == 0:
- Each byte of the hash IS one digit (0-255)
- messagesize = 32 digits
- checksum = (messagesize << w) - sum = 8192 - sum
- checksumsize = 14 bits, extracted as 2 digits

Matches WinternitzOTSignature.getSignature() for w=8 case

## Parameters

### hash32

`Uint8Array`

### ps?

[`ParamSet`](../type-aliases/ParamSet.md)

## Returns

`object`

### checksumDigits

> **checksumDigits**: `number`[]

### digits

> **digits**: `number`[]

### total

> **total**: `number`
