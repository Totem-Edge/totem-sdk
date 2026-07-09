[**@totemsdk/core**](../index.md)

***

[@totemsdk/core](../index.md) / StatefulGameHelper

# Class: StatefulGameHelper

Stateful Game Helper

Creates multi-round stateful contracts (like coin flip).

## Constructors

### Constructor

> **new StatefulGameHelper**(): `StatefulGameHelper`

#### Returns

`StatefulGameHelper`

## Methods

### buildNextRoundState()

> `static` **buildNextRoundState**(`currentRound`, `preservedPorts`, `newStates`): [`StateValue`](../interfaces/StateValue.md)[]

Build state for next round.

#### Parameters

##### currentRound

`number`

##### preservedPorts

`number`[]

##### newStates

[`StateValue`](../interfaces/StateValue.md)[]

#### Returns

[`StateValue`](../interfaces/StateValue.md)[]

***

### createRoundCheck()

> `static` **createRoundCheck**(): `string`

Create a round increment assertion.

#### Returns

`string`

***

### validateRound()

> `static` **validateRound**(`previousRound`, `currentRound`): `boolean`

Validate round progression.

#### Parameters

##### previousRound

`number`

##### currentRound

`number`

#### Returns

`boolean`
