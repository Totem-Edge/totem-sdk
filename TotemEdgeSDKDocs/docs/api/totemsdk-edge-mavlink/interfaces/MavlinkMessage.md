[**@totemsdk/edge-mavlink**](../index.md)

***

[@totemsdk/edge-mavlink](../index.md) / MavlinkMessage

# Interface: MavlinkMessage

## Extends

- [`MavlinkFrame`](MavlinkFrame.md)

## Properties

### compatFlags

> **compatFlags**: `number`

#### Inherited from

[`MavlinkFrame`](MavlinkFrame.md).[`compatFlags`](MavlinkFrame.md#compatflags)

***

### componentId

> **componentId**: `number`

#### Inherited from

[`MavlinkFrame`](MavlinkFrame.md).[`componentId`](MavlinkFrame.md#componentid)

***

### decoded

> **decoded**: `Record`\<`string`, `unknown`\>

***

### incompatFlags

> **incompatFlags**: `number`

#### Inherited from

[`MavlinkFrame`](MavlinkFrame.md).[`incompatFlags`](MavlinkFrame.md#incompatflags)

***

### messageId

> **messageId**: `number`

#### Inherited from

[`MavlinkFrame`](MavlinkFrame.md).[`messageId`](MavlinkFrame.md#messageid)

***

### name

> **name**: `string`

***

### payload

> **payload**: `Uint8Array`

#### Inherited from

[`MavlinkFrame`](MavlinkFrame.md).[`payload`](MavlinkFrame.md#payload)

***

### sequence

> **sequence**: `number`

#### Inherited from

[`MavlinkFrame`](MavlinkFrame.md).[`sequence`](MavlinkFrame.md#sequence)

***

### signature?

> `optional` **signature?**: `Uint8Array`\<`ArrayBufferLike`\>

#### Inherited from

[`MavlinkFrame`](MavlinkFrame.md).[`signature`](MavlinkFrame.md#signature)

***

### systemId

> **systemId**: `number`

#### Inherited from

[`MavlinkFrame`](MavlinkFrame.md).[`systemId`](MavlinkFrame.md#systemid)

***

### version

> **version**: [`MavlinkVersion`](../type-aliases/MavlinkVersion.md)

#### Inherited from

[`MavlinkFrame`](MavlinkFrame.md).[`version`](MavlinkFrame.md#version)
