[**@totemsdk/industrial-action**](../index.md)

***

[@totemsdk/industrial-action](../index.md) / DeviceOpBase

# Interface: DeviceOpBase

Adapter-prepared device command (before commitment/identity are attached).

## Extended by

- [`PreparedDeviceOp`](PreparedDeviceOp.md)

## Properties

### command?

> `optional` **command?**: `unknown`

Opaque, adapter-specific prepared command.

***

### resourceId?

> `optional` **resourceId?**: `string`

Target resource (RFC-011 formalizes the full `ResourceId`).
