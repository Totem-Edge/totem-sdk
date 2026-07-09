[**@totemsdk/node**](../index.md)

***

[@totemsdk/node](../index.md) / serializeMMREntryNumber

# Function: serializeMMREntryNumber()

> **serializeMMREntryNumber**(`entry`): `Uint8Array`

Serialize MMREntryNumber matching Java MMREntryNumber.writeDataStream()

From MMREntryNumber.java:
  MiniNumber.WriteToStream(zOut, mNumber.scale());
  MiniData.WriteToStream(zOut, mNumber.unscaledValue().toByteArray());

## Parameters

### entry

[`JavaMMREntryNumber`](../interfaces/JavaMMREntryNumber.md)

MMREntryNumber to serialize

## Returns

`Uint8Array`

Serialized bytes: MiniNumber(scale) + MiniData(unscaled bytes)
