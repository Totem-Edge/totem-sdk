[**@totemsdk/decision**](../index.md)

***

[@totemsdk/decision](../index.md) / DecisionObservation

# Interface: DecisionObservation

Optional lightweight observation. This is not a sensor framework; specialist
models (intelligence) produce `DecisionValue`s.

## Properties

### confidence?

> `readonly` `optional` **confidence?**: `number`

***

### evidenceId?

> `readonly` `optional` **evidenceId?**: `string`

***

### id

> `readonly` **id**: `string`

***

### kind

> `readonly` **kind**: `string`

***

### model?

> `readonly` `optional` **model?**: `object`

#### digest?

> `readonly` `optional` **digest?**: `string`

#### id?

> `readonly` `optional` **id?**: `string`

#### revision?

> `readonly` `optional` **revision?**: `string`

***

### observedAt?

> `readonly` `optional` **observedAt?**: `number`

***

### value

> `readonly` **value**: [`DecisionValue`](../type-aliases/DecisionValue.md)
