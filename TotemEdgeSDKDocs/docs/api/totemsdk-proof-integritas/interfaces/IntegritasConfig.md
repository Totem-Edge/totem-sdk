[**@totemsdk/proof-integritas**](../index.md)

***

[@totemsdk/proof-integritas](../index.md) / IntegritasConfig

# Interface: IntegritasConfig

Configuration for the Integritas proof provider.

## Properties

### apiKey?

> `optional` **apiKey?**: `string`

***

### baseUrl?

> `optional` **baseUrl?**: `string`

***

### fetch?

> `optional` **fetch?**: \{(`input`, `init?`): `Promise`\<`Response`\>; (`input`, `init?`): `Promise`\<`Response`\>; \}

#### Call Signature

> (`input`, `init?`): `Promise`\<`Response`\>

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Window/fetch)

##### Parameters

###### input

`RequestInfo` \| `URL`

###### init?

`RequestInit`

##### Returns

`Promise`\<`Response`\>

#### Call Signature

> (`input`, `init?`): `Promise`\<`Response`\>

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Window/fetch)

##### Parameters

###### input

`string` \| `Request` \| `URL`

###### init?

`RequestInit`

##### Returns

`Promise`\<`Response`\>

***

### requestIdFactory?

> `optional` **requestIdFactory?**: () => `string`

#### Returns

`string`
