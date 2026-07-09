[**@totem/sdk-browser**](../index.md)

***

[@totem/sdk-browser](../index.md) / DefaultTimerAdapter

# Class: DefaultTimerAdapter

## Implements

- `TimerAdapter`

## Constructors

### Constructor

> **new DefaultTimerAdapter**(): `DefaultTimerAdapter`

#### Returns

`DefaultTimerAdapter`

## Methods

### clearInterval()

> **clearInterval**(`handle`): `void`

#### Parameters

##### handle

`Timeout`

#### Returns

`void`

#### Implementation of

`TimerAdapter.clearInterval`

***

### clearTimeout()

> **clearTimeout**(`handle`): `void`

#### Parameters

##### handle

`Timeout`

#### Returns

`void`

#### Implementation of

`TimerAdapter.clearTimeout`

***

### now()

> **now**(): `number`

#### Returns

`number`

#### Implementation of

`TimerAdapter.now`

***

### setInterval()

> **setInterval**(`callback`, `ms`): `Timeout`

#### Parameters

##### callback

() => `void`

##### ms

`number`

#### Returns

`Timeout`

#### Implementation of

`TimerAdapter.setInterval`

***

### setTimeout()

> **setTimeout**(`callback`, `ms`): `Timeout`

#### Parameters

##### callback

() => `void`

##### ms

`number`

#### Returns

`Timeout`

#### Implementation of

`TimerAdapter.setTimeout`
