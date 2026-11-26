[**@totemsdk/manifest**](../index.md)

***

[@totemsdk/manifest](../index.md) / UpdateCheckerOptions

# Interface: UpdateCheckerOptions

## Properties

### fetchImpl?

> `optional` **fetchImpl?**: \{(`input`, `init?`): `Promise`\<`Response`\>; (`input`, `init?`): `Promise`\<`Response`\>; \}

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

### installed?

> `optional` **installed?**: `Record`\<`string`, `string`\>

Installed versions. Defaults to discoverInstalledTotemPackages().

***

### intervalMs?

> `optional` **intervalMs?**: `number`

Poll interval (default 6h).

***

### now?

> `optional` **now?**: () => `number`

Inject a deterministic clock for tests.

#### Returns

`number`

***

### onError?

> `optional` **onError?**: (`error`) => `void`

#### Parameters

##### error

`unknown`

#### Returns

`void`

***

### onResult?

> `optional` **onResult?**: (`result`) => `void`

Called with a non-empty evaluation. Never called with empty results.

#### Parameters

##### result

[`ReleaseFeedEvaluation`](ReleaseFeedEvaluation.md)

#### Returns

`void`

***

### random?

> `optional` **random?**: () => `number`

#### Returns

`number`

***

### url?

> `optional` **url?**: `string`

Release-feed URL. Required; without it `start()` is a no-op.
