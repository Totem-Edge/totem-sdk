[**@totemsdk/industrial-action**](../index.md)

***

[@totemsdk/industrial-action](../index.md) / RecipeRunOptions

# Interface: RecipeRunOptions

## Properties

### concurrency?

> `optional` **concurrency?**: `number`

Override the recipe concurrency.

***

### context?

> `optional` **context?**: `Record`\<`string`, `unknown`\>

Shared context passed to `when` condition evaluation.

***

### evaluateWhen?

> `optional` **evaluateWhen?**: (`step`, `context`) => `boolean`

Override `when` evaluation (default: `evaluateConditions`).

#### Parameters

##### step

[`ActionStep`](ActionStep.md)

##### context

`Record`\<`string`, `unknown`\>

#### Returns

`boolean`

***

### execute

> **execute**: (`step`) => `Promise`\<[`IndustrialExecutionResult`](IndustrialExecutionResult.md)\<`unknown`\>\>

Execute one step (typically via the governed edge runtime).

#### Parameters

##### step

[`ActionStep`](ActionStep.md)

#### Returns

`Promise`\<[`IndustrialExecutionResult`](IndustrialExecutionResult.md)\<`unknown`\>\>
