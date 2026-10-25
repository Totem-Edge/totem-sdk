[**@totemsdk/decision**](../index.md)

***

[@totemsdk/decision](../index.md) / DecisionRuntimeOptions

# Interface: DecisionRuntimeOptions

## Properties

### defaultTimeoutMs?

> `readonly` `optional` **defaultTimeoutMs?**: `number`

***

### generateRequestId?

> `readonly` `optional` **generateRequestId?**: `boolean`

Generate a `requestId` when the request omits one. Defaults to true.

***

### includeRawProviderOutput?

> `readonly` `optional` **includeRawProviderOutput?**: `boolean`

Raw provider output is omitted by default.

***

### now?

> `readonly` `optional` **now?**: () => `number`

#### Returns

`number`

***

### onAttempt?

> `readonly` `optional` **onAttempt?**: (`attempt`) => `void`

#### Parameters

##### attempt

[`DecisionAttempt`](DecisionAttempt.md)

#### Returns

`void`

***

### onReceipt?

> `readonly` `optional` **onReceipt?**: (`receipt`) => `void`

#### Parameters

##### receipt

[`DecisionReceipt`](DecisionReceipt.md)

#### Returns

`void`

***

### providers?

> `readonly` `optional` **providers?**: `Record`\<`string`, [`DecisionProvider`](DecisionProvider.md)\>

***

### routes

> `readonly` **routes**: readonly [`DecisionRoute`](DecisionRoute.md)[]
