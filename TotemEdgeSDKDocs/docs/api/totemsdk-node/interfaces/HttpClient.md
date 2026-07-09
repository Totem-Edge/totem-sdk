[**@totemsdk/node**](../index.md)

***

[@totemsdk/node](../index.md) / HttpClient

# Interface: HttpClient

## Methods

### delete()

> **delete**\<`T`\>(`url`, `options?`): `Promise`\<[`HttpResponse`](HttpResponse.md)\<`T`\>\>

#### Type Parameters

##### T

`T`

#### Parameters

##### url

`string`

##### options?

[`HttpRequestOptions`](HttpRequestOptions.md)

#### Returns

`Promise`\<[`HttpResponse`](HttpResponse.md)\<`T`\>\>

***

### get()

> **get**\<`T`\>(`url`, `options?`): `Promise`\<[`HttpResponse`](HttpResponse.md)\<`T`\>\>

#### Type Parameters

##### T

`T`

#### Parameters

##### url

`string`

##### options?

[`HttpRequestOptions`](HttpRequestOptions.md)

#### Returns

`Promise`\<[`HttpResponse`](HttpResponse.md)\<`T`\>\>

***

### post()

> **post**\<`T`\>(`url`, `body?`, `options?`): `Promise`\<[`HttpResponse`](HttpResponse.md)\<`T`\>\>

#### Type Parameters

##### T

`T`

#### Parameters

##### url

`string`

##### body?

`unknown`

##### options?

[`HttpRequestOptions`](HttpRequestOptions.md)

#### Returns

`Promise`\<[`HttpResponse`](HttpResponse.md)\<`T`\>\>

***

### put()

> **put**\<`T`\>(`url`, `body?`, `options?`): `Promise`\<[`HttpResponse`](HttpResponse.md)\<`T`\>\>

#### Type Parameters

##### T

`T`

#### Parameters

##### url

`string`

##### body?

`unknown`

##### options?

[`HttpRequestOptions`](HttpRequestOptions.md)

#### Returns

`Promise`\<[`HttpResponse`](HttpResponse.md)\<`T`\>\>
