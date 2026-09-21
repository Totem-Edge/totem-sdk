[**@totemsdk/qvac**](../index.md)

***

[@totemsdk/qvac](../index.md) / LoadModelOptions

# Interface: LoadModelOptions

## Indexable

> \[`key`: `string`\]: `unknown`

## Properties

### fallbackSrc?

> `optional` **fallbackSrc?**: `string`

***

### logger?

> `optional` **logger?**: `unknown`

***

### modelConfig?

> `optional` **modelConfig?**: `Record`\<`string`, `unknown`\>

***

### modelId?

> `optional` **modelId?**: `string`

***

### modelSrc

> **modelSrc**: `string`

***

### modelType?

> `optional` **modelType?**: `string`

***

### onProgress?

> `optional` **onProgress?**: (`progress`) => `void`

#### Parameters

##### progress

###### downloaded

`number`

###### percentage

`number`

###### total?

`number`

###### type

`string`

#### Returns

`void`

***

### requireHttpChecksum?

> `optional` **requireHttpChecksum?**: `boolean`

***

### requireSecureTransport?

> `optional` **requireSecureTransport?**: `boolean`
