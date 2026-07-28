[**@totemsdk/edge-can**](../index.md)

***

[@totemsdk/edge-can](../index.md) / CanFrame

# Interface: CanFrame

## Properties

### data

> **data**: `Uint8Array`

Data bytes (0-8).

***

### dlc

> **dlc**: `number`

Data length code.

***

### id

> **id**: `number`

11-bit or 29-bit arbitration ID.

***

### isExtended

> **isExtended**: `boolean`

Whether this is an extended (29-bit) frame.

***

### isRtr

> **isRtr**: `boolean`

Whether this is a remote transmission request.

***

### receivedAt

> **receivedAt**: `number`

Timestamp of receipt.
