[**@totemsdk/omnia**](../index.md)

***

[@totemsdk/omnia](../index.md) / AxiaFundingProofProviderConfig

# Interface: AxiaFundingProofProviderConfig

## Properties

### apiBase

> **apiBase**: `string`

Axia API base, e.g. `https://api.axia.to`.

***

### apiKey

> **apiKey**: `string`

Project/API key sent as `x-api-key`.

***

### fetchImpl?

> `optional` **fetchImpl?**: \{(`input`, `init?`): `Promise`\<`Response`\>; (`input`, `init?`): `Promise`\<`Response`\>; \}

Injectable fetch for tests.

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

### fundingScript

> **fundingScript**: `string`

KISSVM script whose hash is the funding coin's address.
