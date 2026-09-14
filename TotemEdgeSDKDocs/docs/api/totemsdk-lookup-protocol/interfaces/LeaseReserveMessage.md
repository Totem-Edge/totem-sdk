[**@totemsdk/lookup-protocol**](../index.md)

***

[@totemsdk/lookup-protocol](../index.md) / LeaseReserveMessage

# Interface: LeaseReserveMessage

## Extends

- `BaseMessage`

## Properties

### id?

> `optional` **id?**: `string`

#### Inherited from

`BaseMessage.id`

***

### payload

> **payload**: `object`

#### branchId?

> `optional` **branchId?**: `string`

#### deviceId?

> `optional` **deviceId?**: `string`

#### indices?

> `optional` **indices?**: `WotsIndices`

Optional — when present, the node must reserve these exact indices
 (quorum attestation) instead of allocating the next free slot.

#### payloadHash?

> `optional` **payloadHash?**: `string`

#### purpose?

> `optional` **purpose?**: `string`

#### treeId

> **treeId**: `string`

#### ttlMs?

> `optional` **ttlMs?**: `number`

***

### sig?

> `optional` **sig?**: `string`

#### Inherited from

`BaseMessage.sig`

***

### type

> **type**: `"LEASE_RESERVE"`

#### Overrides

`BaseMessage.type`

***

### version

> **version**: `number`

#### Inherited from

`BaseMessage.version`
