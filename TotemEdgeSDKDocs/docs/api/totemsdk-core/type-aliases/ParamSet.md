[**@totemsdk/core**](../index.md)

***

[@totemsdk/core](../index.md) / ParamSet

# Type Alias: ParamSet

> **ParamSet** = `object`

WOTS Parameter Set - BouncyCastle Compatible (w=8)

Matches Minima Java implementation which uses BouncyCastle:
- Winternitz.java: WINTERNITZ_VALUE = 8
- WinternitzOTSignature.java: w=8 means 8 BITS per digit (not base-8)
- SHA3-256 hash function (mdsize = 32 bytes)

Chain count calculation (from WinternitzOTSignature constructor):
  messagesize = ((mdsize << 3) + w - 1) / w = (256 + 7) / 8 = 32
  checksumsize = getLog((messagesize << w) + 1) = getLog(8193) = 14 bits
  keysize = messagesize + (checksumsize + w - 1) / w = 32 + (14 + 7) / 8 = 34

So L = 34 chains total, each chain value is 0-255 (8-bit digit)

## Properties

### checksumDigits

> **checksumDigits**: `2`

***

### checksumSize

> **checksumSize**: `14`

***

### L

> **L**: `34`

***

### maxDigit

> **maxDigit**: `255`

***

### messageSize

> **messageSize**: `32`

***

### n

> **n**: `256`

***

### name

> **name**: `"minima"`

***

### w

> **w**: `8`
