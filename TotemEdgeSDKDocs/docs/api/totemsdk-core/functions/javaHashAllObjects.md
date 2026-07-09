[**@totemsdk/core**](../index.md)

***

[@totemsdk/core](../index.md) / javaHashAllObjects

# Function: javaHashAllObjects()

> **javaHashAllObjects**(...`items`): `Uint8Array`

Java hashAllObjects for MMRData hashing
Used for MMRData.CreateMMRDataLeafNode and CreateMMRDataParentNode

From Crypto.java hashAllObjects:
Serializes each Streamable object and hashes the concatenation.

For MMRData, the serialization is:
- MiniNumber: [scale][len][data] (see serializeMiniNumber)
- MiniData: [4-byte len][data] for writeDataStream
- Hash: [4-byte len][data] for writeHashToStream (same as MiniData)

CRITICAL: Java writeHashToStream uses writeInt (4-byte prefix),
identical to writeDataStream. See MiniData.java lines 282-289.

## Parameters

### items

...`Uint8Array`\<`ArrayBufferLike`\>[]

Pre-serialized items to concatenate and hash

## Returns

`Uint8Array`

32-byte SHA3-256 hash
