[**@totemsdk/core**](../index.md)

***

[@totemsdk/core](../index.md) / Bytes

# Type Alias: Bytes

> **Bytes** = `Uint8Array`

Streamable.ts - Canonical Java-Compatible Serialization Primitives

This module provides byte-exact serialization functions matching
Minima's Java Streamable interface and its implementations.

JAVA REFERENCE CLASSES:
  - MiniData.writeDataStream(): 4-byte int length + raw bytes
  - MiniNumber.writeDataStream(): 1-byte scale + 1-byte len + BigInteger bytes
  - MiniString.writeDataStream(): delegates to MiniData(UTF-8 bytes)
  - MiniByte.writeDataStream(): single byte
  - Crypto.writeHashToStream(): 4-byte int length + hash bytes
  - MMREntryNumber.writeDataStream(): 1-byte len + BigInteger bytes

CRITICAL NOTES:
  - MiniNumber uses 1-byte length, NOT 4-byte like MiniData
  - BigInteger.toByteArray() uses two's complement (leading 0 if high bit set)
  - Zero encodes as length=1, value=0x00

Created: 2026-01-20
Purpose: Single source of truth for all Minima type serialization
