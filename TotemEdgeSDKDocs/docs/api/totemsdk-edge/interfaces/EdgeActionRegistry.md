[**@totemsdk/edge**](../index.md)

***

[@totemsdk/edge](../index.md) / EdgeActionRegistry

# Interface: EdgeActionRegistry

## Methods

### isUngrantable()

> **isUngrantable**(`action`): `boolean`

#### Parameters

##### action

`string`

#### Returns

`boolean`

***

### listActions()

> **listActions**(): `string`[]

#### Returns

`string`[]

***

### register()

> **register**(`def`, `action`): `void`

#### Parameters

##### def

[`EdgeActionDefinition`](EdgeActionDefinition.md)

##### action

`string` \| `string`[]

#### Returns

`void`

***

### resolve()

> **resolve**(`action`): [`EdgeActionDefinition`](EdgeActionDefinition.md) \| `undefined`

#### Parameters

##### action

`string`

#### Returns

[`EdgeActionDefinition`](EdgeActionDefinition.md) \| `undefined`
