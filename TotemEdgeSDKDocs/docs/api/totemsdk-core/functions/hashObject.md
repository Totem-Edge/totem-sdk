[**@totemsdk/core**](../index.md)

***

[@totemsdk/core](../index.md) / hashObject

# Function: hashObject()

> **hashObject**(`data`): `Uint8Array`

Hash a single object matching Java's Crypto.hashObject()

From TreeKeyNode.java line 30:
  mChildSeed = Crypto.getInstance().hashObject(zPrivateSeed);

This serializes the object as MiniData (length-prefixed) and hashes it.

## Parameters

### data

`Uint8Array`

Raw bytes (will be serialized as MiniData)

## Returns

`Uint8Array`

32-byte SHA3-256 hash
