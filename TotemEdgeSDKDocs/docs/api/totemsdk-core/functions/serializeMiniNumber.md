[**@totemsdk/core**](../index.md)

***

[@totemsdk/core](../index.md) / serializeMiniNumber

# Function: serializeMiniNumber()

> **serializeMiniNumber**(`n`): `Uint8Array`

Serialize a number in MiniNumber format (Java compatible)

Thin wrapper over Streamable.writeMiniNumber that accepts number for backward compatibility.

## Parameters

### n

`number`

Non-negative integer to serialize

## Returns

`Uint8Array`

Serialized bytes matching Java MiniNumber format
