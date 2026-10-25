[**@totemsdk/industrial-action**](../index.md)

***

[@totemsdk/industrial-action](../index.md) / UnitRegistry

# Interface: UnitRegistry

## Methods

### compatible()

> **compatible**(`a`, `b`): `boolean`

True when both units belong to the same dimension.

#### Parameters

##### a

`string`

##### b

`string`

#### Returns

`boolean`

***

### convert()

> **convert**(`quantity`, `to`): [`Quantity`](Quantity.md)

Convert a quantity to another unit of the same dimension. Throws otherwise.

#### Parameters

##### quantity

[`Quantity`](Quantity.md)

##### to

`string`

#### Returns

[`Quantity`](Quantity.md)

***

### dimensionOf()

> **dimensionOf**(`unit`): [`Dimension`](../type-aliases/Dimension.md) \| `undefined`

#### Parameters

##### unit

`string`

#### Returns

[`Dimension`](../type-aliases/Dimension.md) \| `undefined`

***

### has()

> **has**(`unit`): `boolean`

#### Parameters

##### unit

`string`

#### Returns

`boolean`

***

### register()

> **register**(`unit`, `dimension`, `toCanonical`, `fromCanonical`): `void`

#### Parameters

##### unit

`string`

##### dimension

[`Dimension`](../type-aliases/Dimension.md)

##### toCanonical

(`v`) => `number`

##### fromCanonical

(`v`) => `number`

#### Returns

`void`

***

### units()

> **units**(`dimension?`): `string`[]

#### Parameters

##### dimension?

[`Dimension`](../type-aliases/Dimension.md)

#### Returns

`string`[]
