[**@totemsdk/statechain**](../index.md)

***

[@totemsdk/statechain](../index.md) / ResolveSEClientOptions

# Interface: ResolveSEClientOptions

## Properties

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

### registryUrl?

> `optional` **registryUrl?**: `string`

***

### timeoutMs?

> `optional` **timeoutMs?**: `number`

Timeout for SE HTTP requests in milliseconds. Default 30 000.
