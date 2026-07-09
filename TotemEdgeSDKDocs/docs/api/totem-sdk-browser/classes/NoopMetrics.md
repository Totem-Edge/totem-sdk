[**@totem/sdk-browser**](../index.md)

***

[@totem/sdk-browser](../index.md) / NoopMetrics

# Class: NoopMetrics

## Implements

- `MetricsAdapter`

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

`MetricsAdapter.gauge`

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

`MetricsAdapter.histogram`

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

`MetricsAdapter.increment`

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

`MetricsAdapter.timing`
