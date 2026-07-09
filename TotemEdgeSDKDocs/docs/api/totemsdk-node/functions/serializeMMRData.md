[**@totemsdk/node**](../index.md)

***

[@totemsdk/node](../index.md) / serializeMMRData

# Function: serializeMMRData()

> **serializeMMRData**(`mmrData`): `Uint8Array`

Serialize MMRData matching Java MMRData.writeDataStream()

From MMRData.java:
  mData.writeHashToStream(zOut);  // 4-byte length prefix + hash bytes
  mValue.writeDataStream(zOut);   // MiniNumber format

## Parameters

### mmrData

[`JavaMMRData`](../interfaces/JavaMMRData.md)

MMRData to serialize

## Returns

`Uint8Array`

Serialized bytes: writeHashToStream(hash) + MiniNumber(value)
