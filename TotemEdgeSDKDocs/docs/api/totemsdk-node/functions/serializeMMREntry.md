[**@totemsdk/node**](../index.md)

***

[@totemsdk/node](../index.md) / serializeMMREntry

# Function: serializeMMREntry()

> **serializeMMREntry**(`entry`): `Uint8Array`

Serialize MMREntry matching Java MMREntry.writeDataStream()

From MMREntry.java:
  MiniNumber row = new MiniNumber(mRow);
  row.writeDataStream(zOut);
  mEntryNumber.writeDataStream(zOut);
  mMMRData.writeDataStream(zOut);

## Parameters

### entry

[`JavaMMREntry`](../interfaces/JavaMMREntry.md)

MMREntry to serialize

## Returns

`Uint8Array`

Serialized bytes: MiniNumber(row) + MMREntryNumber + MMRData
