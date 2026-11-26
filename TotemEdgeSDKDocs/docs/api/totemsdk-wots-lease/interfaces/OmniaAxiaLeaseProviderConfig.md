[**@totemsdk/wots-lease**](../index.md)

***

[@totemsdk/wots-lease](../index.md) / OmniaAxiaLeaseProviderConfig

# Interface: OmniaAxiaLeaseProviderConfig

## Properties

### addressIndex

> **addressIndex**: `number`

Wallet address index whose per-address TreeKey signs the channel.

***

### apiKey

> **apiKey**: `string`

***

### apiUrl

> **apiUrl**: `string`

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

### logger?

> `optional` **logger?**: `LoggerAdapter`

***

### rootPublicKey

> **rootPublicKey**: `string`

Wallet root public key (0x-prefixed 32-byte hex).

***

### storage

> **storage**: `StorageAdapter`
