[**@totemsdk/lookup-protocol**](../index.md)

***

[@totemsdk/lookup-protocol](../index.md) / LeaseWatermarkMessage

# Interface: LeaseWatermarkMessage

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

#### addressCursor

> **addressCursor**: `number`

#### l1Cursor

> **l1Cursor**: `number`

#### l2Cursor

> **l2Cursor**: `number`

#### lastSyncTimestamp

> **lastSyncTimestamp**: `number`

#### treeId

> **treeId**: `string`

#### unavailableCount

> **unavailableCount**: `number`

***

### sig?

> `optional` **sig?**: `string`

#### Inherited from

`BaseMessage.sig`

***

### type

> **type**: `"LEASE_WATERMARK"`

#### Overrides

`BaseMessage.type`

***

### version

> **version**: `number`

#### Inherited from

`BaseMessage.version`
