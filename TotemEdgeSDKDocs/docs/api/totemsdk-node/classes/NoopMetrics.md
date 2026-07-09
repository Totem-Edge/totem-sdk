[**@totemsdk/node**](../index.md)

***

[@totemsdk/node](../index.md) / NoopMetrics

# Class: NoopMetrics

## Implements

- [`MetricsAdapter`](../interfaces/MetricsAdapter.md)

## Constructors

### Constructor

> **new NoopMetrics**(): `NoopMetrics`

#### Returns

`NoopMetrics`

## Methods

### gauge()

> **gauge**(`_name`, `_value`, `_tags?`): `void`

#### Parameters

##### \_name

`string`

##### \_value

`number`

##### \_tags?

`Record`\<`string`, `string`\>

#### Returns

`void`

#### Implementation of

[`MetricsAdapter`](../interfaces/MetricsAdapter.md).[`gauge`](../interfaces/MetricsAdapter.md#gauge)

***

### histogram()

> **histogram**(`_name`, `_value`, `_tags?`): `void`

#### Parameters

##### \_name

`string`

##### \_value

`number`

##### \_tags?

`Record`\<`string`, `string`\>

#### Returns

`void`

#### Implementation of

[`MetricsAdapter`](../interfaces/MetricsAdapter.md).[`histogram`](../interfaces/MetricsAdapter.md#histogram)

***

### increment()

> **increment**(`_name`, `_value?`, `_tags?`): `void`

#### Parameters

##### \_name

`string`

##### \_value?

`number`

##### \_tags?

`Record`\<`string`, `string`\>

#### Returns

`void`

#### Implementation of

[`MetricsAdapter`](../interfaces/MetricsAdapter.md).[`increment`](../interfaces/MetricsAdapter.md#increment)

***

### timing()

> **timing**(`_name`, `_durationMs`, `_tags?`): `void`

#### Parameters

##### \_name

`string`

##### \_durationMs

`number`

##### \_tags?

`Record`\<`string`, `string`\>

#### Returns

`void`

#### Implementation of

[`MetricsAdapter`](../interfaces/MetricsAdapter.md).[`timing`](../interfaces/MetricsAdapter.md#timing)
