[**@totemsdk/core**](../index.md)

***

[@totemsdk/core](../index.md) / MetricsAdapter

# Interface: MetricsAdapter

## Methods

### gauge()

> **gauge**(`name`, `value`, `tags?`): `void`

#### Parameters

##### name

`string`

##### value

`number`

##### tags?

`Record`\<`string`, `string`\>

#### Returns

`void`

***

### histogram()

> **histogram**(`name`, `value`, `tags?`): `void`

#### Parameters

##### name

`string`

##### value

`number`

##### tags?

`Record`\<`string`, `string`\>

#### Returns

`void`

***

### increment()

> **increment**(`name`, `value?`, `tags?`): `void`

#### Parameters

##### name

`string`

##### value?

`number`

##### tags?

`Record`\<`string`, `string`\>

#### Returns

`void`

***

### timing()

> **timing**(`name`, `durationMs`, `tags?`): `void`

#### Parameters

##### name

`string`

##### durationMs

`number`

##### tags?

`Record`\<`string`, `string`\>

#### Returns

`void`
