[**@totemsdk/connect**](../index.md)

***

[@totemsdk/connect](../index.md) / AxiaContractClientOptions

# Interface: AxiaContractClientOptions

## Properties

### adminKey?

> `readonly` `optional` **adminKey?**: `string`

Admin key for the mirror write (`x-admin-key`). Never logged.

***

### baseUrl?

> `readonly` `optional` **baseUrl?**: `string`

Axia base URL. Defaults to [AXIA\_DEFAULT\_API\_BASE](../variables/AXIA_DEFAULT_API_BASE.md).

***

### fetch?

> `readonly` `optional` **fetch?**: \{(`input`, `init?`): `Promise`\<`Response`\>; (`input`, `init?`): `Promise`\<`Response`\>; \}

Fetch implementation. Defaults to `globalThis.fetch` (Node 18+).

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

### timeoutMs?

> `readonly` `optional` **timeoutMs?**: `number`

Abort after this many ms.
