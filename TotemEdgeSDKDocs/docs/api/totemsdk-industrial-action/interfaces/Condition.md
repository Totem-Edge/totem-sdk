[**@totemsdk/industrial-action**](../index.md)

***

[@totemsdk/industrial-action](../index.md) / Condition

# Interface: Condition

## Properties

### evaluate?

> `optional` **evaluate?**: (`params`, `context`) => `string` \| `null`

#### Parameters

##### params

`Record`\<`string`, `unknown`\>

##### context

`Record`\<`string`, `unknown`\>

#### Returns

`string` \| `null`

***

### field?

> `optional` **field?**: `string`

***

### operator?

> `optional` **operator?**: `"eq"` \| `"neq"` \| `"gt"` \| `"gte"` \| `"lt"` \| `"lte"` \| `"in"` \| `"not_in"`

***

### type

> **type**: `"parameter_range"` \| `"context_match"` \| `"time_window"` \| `"custom"`

***

### value?

> `optional` **value?**: `unknown`
