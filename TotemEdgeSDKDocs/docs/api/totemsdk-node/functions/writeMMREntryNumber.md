[**@totemsdk/node**](../index.md)

***

[@totemsdk/node](../index.md) / writeMMREntryNumber

# Function: writeMMREntryNumber()

> **writeMMREntryNumber**(`value`, `scale?`): `Uint8Array`

Encode an MMREntryNumber per Java MMREntryNumber.writeDataStream()

Java source (MMREntryNumber.java):
  MiniNumber.WriteToStream(zOut, mNumber.scale());   // scale as MiniNumber
  MiniData.WriteToStream(zOut, mNumber.unscaledValue().toByteArray()); // unscaled as MiniData

Format:
  - MiniNumber for scale (always 0 for integer values)
  - MiniData for unscaled BigInteger value

For integer MMREntryNumber (scale=0), this encodes as:
  [00 01 00]        - MiniNumber: scale=0, len=1, data=0x00
  [00 00 00 LL ...] - MiniData: 4-byte len + BigInteger bytes

## Parameters

### value

`bigint`

### scale?

`number`

## Returns

`Uint8Array`
