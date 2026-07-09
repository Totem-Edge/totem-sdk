[**@totemsdk/core**](../index.md)

***

[@totemsdk/core](../index.md) / writeHashToStream

# Function: writeHashToStream()

> **writeHashToStream**(`data`): `Uint8Array`

Serialize hash in MiniData.writeHashToStream format (4-byte length prefix)

Re-export of Streamable.writeHashToStream for backward compatibility.

## Parameters

### data

`Uint8Array`

Hash bytes (max 64 bytes per MINIMA_MAX_HASH_LENGTH)

## Returns

`Uint8Array`

Serialized bytes with 4-byte length prefix
