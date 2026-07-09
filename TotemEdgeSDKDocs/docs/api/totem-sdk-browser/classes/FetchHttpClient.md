[**@totem/sdk-browser**](../index.md)

***

[@totem/sdk-browser](../index.md) / FetchHttpClient

# Class: FetchHttpClient

## Implements

- `HttpClient`

## Constructors

### Constructor

> **new FetchHttpClient**(`options?`): `FetchHttpClient`

#### Parameters

##### options?

[`FetchHttpClientOptions`](../interfaces/FetchHttpClientOptions.md) = `{}`

#### Returns

`FetchHttpClient`

## Methods

### delete()

> **delete**\<`T`\>(`url`, `options?`): `Promise`\<`HttpResponse`\<`T`\>\>

#### Type Parameters

##### T

`T`

#### Parameters

##### url

`string`

##### options?

`HttpRequestOptions`

#### Returns

`Promise`\<`HttpResponse`\<`T`\>\>

#### Implementation of

`HttpClient.delete`

***

### get()

> **get**\<`T`\>(`url`, `options?`): `Promise`\<`HttpResponse`\<`T`\>\>

#### Type Parameters

##### T

`T`

#### Parameters

##### url

`string`

##### options?

`HttpRequestOptions`

#### Returns

`Promise`\<`HttpResponse`\<`T`\>\>

#### Implementation of

`HttpClient.get`

***

### post()

> **post**\<`T`\>(`url`, `body?`, `options?`): `Promise`\<`HttpResponse`\<`T`\>\>

#### Type Parameters

##### T

`T`

#### Parameters

##### url

`string`

##### body?

`unknown`

##### options?

`HttpRequestOptions`

#### Returns

`Promise`\<`HttpResponse`\<`T`\>\>

#### Implementation of

`HttpClient.post`

***

### put()

> **put**\<`T`\>(`url`, `body?`, `options?`): `Promise`\<`HttpResponse`\<`T`\>\>

#### Type Parameters

##### T

`T`

#### Parameters

##### url

`string`

##### body?

`unknown`

##### options?

`HttpRequestOptions`

#### Returns

`Promise`\<`HttpResponse`\<`T`\>\>

#### Implementation of

`HttpClient.put`
