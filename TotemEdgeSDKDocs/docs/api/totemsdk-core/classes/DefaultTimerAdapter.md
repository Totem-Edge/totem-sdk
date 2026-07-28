[**@totemsdk/core**](../index.md)

***

[@totemsdk/core](../index.md) / DefaultTimerAdapter

# Class: DefaultTimerAdapter

## Implements

- [`TimerAdapter`](../interfaces/TimerAdapter.md)

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

`any`

#### Returns

`void`

#### Implementation of

[`TimerAdapter`](../interfaces/TimerAdapter.md).[`clearInterval`](../interfaces/TimerAdapter.md#clearinterval)

***

### clearTimeout()

> **clearTimeout**(`handle`): `void`

#### Parameters

##### handle

`any`

#### Returns

`void`

#### Implementation of

[`TimerAdapter`](../interfaces/TimerAdapter.md).[`clearTimeout`](../interfaces/TimerAdapter.md#cleartimeout)

***

### now()

> **now**(): `number`

#### Returns

`number`

#### Implementation of

[`TimerAdapter`](../interfaces/TimerAdapter.md).[`now`](../interfaces/TimerAdapter.md#now)

***

### setInterval()

> **setInterval**(`callback`, `ms`): `any`

#### Parameters

##### callback

() => `void`

##### ms

`number`

#### Returns

`any`

#### Implementation of

[`TimerAdapter`](../interfaces/TimerAdapter.md).[`setInterval`](../interfaces/TimerAdapter.md#setinterval)

***

### setTimeout()

> **setTimeout**(`callback`, `ms`): `any`

#### Parameters

##### callback

() => `void`

##### ms

`number`

#### Returns

`any`

#### Implementation of

[`TimerAdapter`](../interfaces/TimerAdapter.md).[`setTimeout`](../interfaces/TimerAdapter.md#settimeout)
