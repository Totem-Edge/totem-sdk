[**@totemsdk/node**](../index.md)

***

[@totemsdk/node](../index.md) / hashAllObjects

# Function: hashAllObjects()

> **hashAllObjects**(...`items`): `Uint8Array`

Hash multiple Streamable objects (Java compatible)

From Crypto.java hashAllObjects:
  1. Write each object to DataOutputStream
  2. SHA3-256 hash the combined bytes

This matches TreeKeyNode.java seed derivation:
  Crypto.getInstance().hashAllObjects(new MiniNumber(i), zPrivateSeed)

## Parameters

### items

...`Uint8Array`\<`ArrayBufferLike`\>[]

Array of serialized objects (use serializeMiniNumber/serializeMiniData)

## Returns

`Uint8Array`

32-byte SHA3-256 hash
