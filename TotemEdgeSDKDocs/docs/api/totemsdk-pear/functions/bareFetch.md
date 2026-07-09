[**@totemsdk/pear**](../index.md)

***

[@totemsdk/pear](../index.md) / bareFetch

# Function: bareFetch()

> **bareFetch**(`url`, `init?`): `Promise`\<[`FetchResponse`](../interfaces/FetchResponse.md)\>

Polyfill-aware fetch.

- In environments where `globalThis.fetch` exists: delegates to it.
- Otherwise: uses `bare-http1` (dynamic import) for HTTP/1.1 requests.

## Parameters

### url

`string`

### init?

[`FetchInit`](../interfaces/FetchInit.md) = `{}`

## Returns

`Promise`\<[`FetchResponse`](../interfaces/FetchResponse.md)\>
