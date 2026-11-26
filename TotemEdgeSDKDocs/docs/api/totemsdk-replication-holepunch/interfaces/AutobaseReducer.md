[**@totemsdk/replication-holepunch**](../index.md)

***

[@totemsdk/replication-holepunch](../index.md) / AutobaseReducer

# Interface: AutobaseReducer\<Op, State\>

## Type Parameters

### Op

`Op`

### State

`State`

## Methods

### initialState()

> **initialState**(): `State`

#### Returns

`State`

***

### migrate()?

> `optional` **migrate**(`op`, `fromVersion`): `Op` \| `null`

Optional migration for operations written under an older dataset version.

#### Parameters

##### op

`unknown`

##### fromVersion

`number`

#### Returns

`Op` \| `null`

***

### reduce()

> **reduce**(`state`, `op`): `State`

#### Parameters

##### state

`State`

##### op

`Op`

#### Returns

`State`
