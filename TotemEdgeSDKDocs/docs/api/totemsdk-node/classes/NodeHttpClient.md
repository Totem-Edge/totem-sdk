[**@totemsdk/node**](../index.md)

***

[@totemsdk/node](../index.md) / NodeHttpClient

# Class: NodeHttpClient

## Implements

- [`HttpClient`](../interfaces/HttpClient.md)

## Constructors

### Constructor

> **new NodeHttpClient**(`options?`): `NodeHttpClient`

#### Parameters

##### options?

[`NodeHttpClientOptions`](../interfaces/NodeHttpClientOptions.md) = `{}`

#### Returns

`NodeHttpClient`

## Methods

### delete()

> **delete**\<`T`\>(`url`, `options?`): `Promise`\<[`HttpResponse`](../interfaces/HttpResponse.md)\<`T`\>\>

#### Type Parameters

##### T

`T`

#### Parameters

##### url

`string`

##### options?

[`HttpRequestOptions`](../interfaces/HttpRequestOptions.md)

#### Returns

`Promise`\<[`HttpResponse`](../interfaces/HttpResponse.md)\<`T`\>\>

#### Implementation of

[`HttpClient`](../interfaces/HttpClient.md).[`delete`](../interfaces/HttpClient.md#delete)

***

### get()

> **get**\<`T`\>(`url`, `options?`): `Promise`\<[`HttpResponse`](../interfaces/HttpResponse.md)\<`T`\>\>

#### Type Parameters

##### T

`T`

#### Parameters

##### url

`string`

##### options?

[`HttpRequestOptions`](../interfaces/HttpRequestOptions.md)

#### Returns

`Promise`\<[`HttpResponse`](../interfaces/HttpResponse.md)\<`T`\>\>

#### Implementation of

[`HttpClient`](../interfaces/HttpClient.md).[`get`](../interfaces/HttpClient.md#get)

***

### post()

> **post**\<`T`\>(`url`, `body?`, `options?`): `Promise`\<[`HttpResponse`](../interfaces/HttpResponse.md)\<`T`\>\>

#### Type Parameters

##### T

`T`

#### Parameters

##### url

`string`

##### body?

`unknown`

##### options?

[`HttpRequestOptions`](../interfaces/HttpRequestOptions.md)

#### Returns

`Promise`\<[`HttpResponse`](../interfaces/HttpResponse.md)\<`T`\>\>

#### Implementation of

[`HttpClient`](../interfaces/HttpClient.md).[`post`](../interfaces/HttpClient.md#post)

***

### put()

> **put**\<`T`\>(`url`, `body?`, `options?`): `Promise`\<[`HttpResponse`](../interfaces/HttpResponse.md)\<`T`\>\>

#### Type Parameters

##### T

`T`

#### Parameters

##### url

`string`

##### body?

`unknown`

##### options?

[`HttpRequestOptions`](../interfaces/HttpRequestOptions.md)

#### Returns

`Promise`\<[`HttpResponse`](../interfaces/HttpResponse.md)\<`T`\>\>

#### Implementation of

[`HttpClient`](../interfaces/HttpClient.md).[`put`](../interfaces/HttpClient.md#put)
