[**@totemsdk/node**](../index.md)

***

[@totemsdk/node](../index.md) / DefaultTimerAdapter

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

`Timeout`

#### Returns

`void`

#### Implementation of

[`TimerAdapter`](../interfaces/TimerAdapter.md).[`clearInterval`](../interfaces/TimerAdapter.md#clearinterval)

***

### clearTimeout()

> **clearTimeout**(`handle`): `void`

#### Parameters

##### handle

`Timeout`

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

> **setInterval**(`callback`, `ms`): `Timeout`

#### Parameters

##### callback

() => `void`

##### ms

`number`

#### Returns

`Timeout`

#### Implementation of

[`TimerAdapter`](../interfaces/TimerAdapter.md).[`setInterval`](../interfaces/TimerAdapter.md#setinterval)

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

[`TimerAdapter`](../interfaces/TimerAdapter.md).[`setTimeout`](../interfaces/TimerAdapter.md#settimeout)
