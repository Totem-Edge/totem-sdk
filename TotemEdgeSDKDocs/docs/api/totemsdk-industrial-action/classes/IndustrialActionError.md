[**@totemsdk/industrial-action**](../index.md)

***

[@totemsdk/industrial-action](../index.md) / IndustrialActionError

# Class: IndustrialActionError

## Extends

- `Error`

## Extended by

- [`ActionDefinitionError`](ActionDefinitionError.md)
- [`ActionValidationError`](ActionValidationError.md)
- [`ActionExecutionError`](ActionExecutionError.md)
- [`ActionConditionError`](ActionConditionError.md)
- [`ActionGovernanceError`](ActionGovernanceError.md)
- [`ActionCommitmentError`](ActionCommitmentError.md)

## Constructors

### Constructor

> **new IndustrialActionError**(`code`, `message`): `IndustrialActionError`

#### Parameters

##### code

`string`

##### message

`string`

#### Returns

`IndustrialActionError`

#### Overrides

`Error.constructor`

## Properties

### code

> `readonly` **code**: `string`

***

### message

> **message**: `string`

#### Inherited from

`Error.message`

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
