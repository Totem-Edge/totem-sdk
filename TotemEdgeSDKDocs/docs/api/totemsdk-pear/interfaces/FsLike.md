[**@totemsdk/pear**](../index.md)

***

[@totemsdk/pear](../index.md) / FsLike

# Interface: FsLike

## Methods

### closeSync()?

> `optional` **closeSync**(`fd`): `void`

#### Parameters

##### fd

`number`

#### Returns

`void`

***

### existsSync()

> **existsSync**(`path`): `boolean`

#### Parameters

##### path

`string`

#### Returns

`boolean`

***

### fsyncSync()?

> `optional` **fsyncSync**(`fd`): `void`

#### Parameters

##### fd

`number`

#### Returns

`void`

***

### mkdirSync()

> **mkdirSync**(`path`, `options?`): `void`

#### Parameters

##### path

`string`

##### options?

###### recursive?

`boolean`

#### Returns

`void`

***

### openSync()?

> `optional` **openSync**(`path`, `flags`): `number`

#### Parameters

##### path

`string`

##### flags

`string`

#### Returns

`number`

***

### readFileSync()

> **readFileSync**(`path`): `Uint8Array`

#### Parameters

##### path

`string`

#### Returns

`Uint8Array`

***

### renameSync()

> **renameSync**(`from`, `to`): `void`

#### Parameters

##### from

`string`

##### to

`string`

#### Returns

`void`

***

### unlinkSync()

> **unlinkSync**(`path`): `void`

#### Parameters

##### path

`string`

#### Returns

`void`

***

### writeFileSync()

> **writeFileSync**(`path`, `data`): `void`

#### Parameters

##### path

`string`

##### data

`Uint8Array`

#### Returns

`void`
