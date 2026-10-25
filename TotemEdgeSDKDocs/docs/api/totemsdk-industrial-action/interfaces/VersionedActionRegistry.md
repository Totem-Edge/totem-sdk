[**@totemsdk/industrial-action**](../index.md)

***

[@totemsdk/industrial-action](../index.md) / VersionedActionRegistry

# Interface: VersionedActionRegistry

## Methods

### latest()

> **latest**(`kind`): [`IndustrialActionDefinition`](IndustrialActionDefinition.md)\<`unknown`\> \| `undefined`

#### Parameters

##### kind

`string`

#### Returns

[`IndustrialActionDefinition`](IndustrialActionDefinition.md)\<`unknown`\> \| `undefined`

***

### register()

> **register**(`def`): `void`

#### Parameters

##### def

[`IndustrialActionDefinition`](IndustrialActionDefinition.md)

#### Returns

`void`

***

### resolve()

> **resolve**(`kind`, `version?`): [`IndustrialActionDefinition`](IndustrialActionDefinition.md)\<`unknown`\> \| `undefined`

Resolve a specific version, or the latest when `version` is omitted.

#### Parameters

##### kind

`string`

##### version?

`number`

#### Returns

[`IndustrialActionDefinition`](IndustrialActionDefinition.md)\<`unknown`\> \| `undefined`

***

### versions()

> **versions**(`kind`): `number`[]

#### Parameters

##### kind

`string`

#### Returns

`number`[]
