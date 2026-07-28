[**@totemsdk/pureminima-rpc**](../index.md)

***

[@totemsdk/pureminima-rpc](../index.md) / PureMinimaRpcError

# Class: PureMinimaRpcError

## Extends

- `Error`

## Constructors

### Constructor

> **new PureMinimaRpcError**(`message`, `command`, `minimaError?`, `httpStatus?`): `PureMinimaRpcError`

#### Parameters

##### message

`string`

##### command

`string`

##### minimaError?

`string`

##### httpStatus?

`number`

#### Returns

`PureMinimaRpcError`

#### Overrides

`Error.constructor`

## Properties

### command

> `readonly` **command**: `string`

***

### httpStatus?

> `readonly` `optional` **httpStatus?**: `number`

***

### message

> **message**: `string`

#### Inherited from

`Error.message`

***

### minimaError?

> `readonly` `optional` **minimaError?**: `string`

***

### name

> **name**: `string`

#### Inherited from

`Error.name`

***

### stack?

> `optional` **stack?**: `string`

#### Inherited from

`Error.stack`
