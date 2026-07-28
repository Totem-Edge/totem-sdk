[**@totemsdk/industrial-action**](../index.md)

***

[@totemsdk/industrial-action](../index.md) / ActionRegistry

# Class: ActionRegistry

## Constructors

### Constructor

> **new ActionRegistry**(): `ActionRegistry`

#### Returns

`ActionRegistry`

## Methods

### getDefinition()

> **getDefinition**(`kind`): [`IndustrialActionDefinition`](../interfaces/IndustrialActionDefinition.md)\<`unknown`, `unknown`\> \| `undefined`

#### Parameters

##### kind

`string`

#### Returns

[`IndustrialActionDefinition`](../interfaces/IndustrialActionDefinition.md)\<`unknown`, `unknown`\> \| `undefined`

***

### getDefinitionOrThrow()

> **getDefinitionOrThrow**(`kind`): [`IndustrialActionDefinition`](../interfaces/IndustrialActionDefinition.md)

#### Parameters

##### kind

`string`

#### Returns

[`IndustrialActionDefinition`](../interfaces/IndustrialActionDefinition.md)

***

### getExecutor()

> **getExecutor**(`kind`): [`ActionExecutor`](../interfaces/ActionExecutor.md)\<`unknown`, `unknown`\> \| `undefined`

#### Parameters

##### kind

`string`

#### Returns

[`ActionExecutor`](../interfaces/ActionExecutor.md)\<`unknown`, `unknown`\> \| `undefined`

***

### getExecutorOrThrow()

> **getExecutorOrThrow**(`kind`): [`ActionExecutor`](../interfaces/ActionExecutor.md)

#### Parameters

##### kind

`string`

#### Returns

[`ActionExecutor`](../interfaces/ActionExecutor.md)

***

### hasDefinition()

> **hasDefinition**(`kind`): `boolean`

#### Parameters

##### kind

`string`

#### Returns

`boolean`

***

### hasExecutor()

> **hasExecutor**(`kind`): `boolean`

#### Parameters

##### kind

`string`

#### Returns

`boolean`

***

### listKinds()

> **listKinds**(): `string`[]

#### Returns

`string`[]

***

### registerDefinition()

> **registerDefinition**(`definition`): `void`

#### Parameters

##### definition

[`IndustrialActionDefinition`](../interfaces/IndustrialActionDefinition.md)

#### Returns

`void`

***

### registerExecutor()

> **registerExecutor**(`executor`): `void`

#### Parameters

##### executor

[`ActionExecutor`](../interfaces/ActionExecutor.md)

#### Returns

`void`
