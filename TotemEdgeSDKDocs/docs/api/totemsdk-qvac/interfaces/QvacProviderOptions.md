[**@totemsdk/qvac**](../index.md)

***

[@totemsdk/qvac](../index.md) / QvacProviderOptions

# Interface: QvacProviderOptions

Options for the QVAC intelligence adapter.

## Properties

### defaultTimeoutMs?

> `readonly` `optional` **defaultTimeoutMs?**: `number`

Timeout for individual operations (ms). Default: none.

***

### lazyConnect?

> `readonly` `optional` **lazyConnect?**: `boolean`

Auto-connect semantics — defaults to true (no-op for local SDK).

***

### onLog?

> `readonly` `optional` **onLog?**: (`level`, `message`, `context?`) => `void`

Logger hook receiving operational diagnostics.

#### Parameters

##### level

`string`

##### message

`string`

##### context?

`unknown`

#### Returns

`void`

***

### resolveOp?

> `readonly` `optional` **resolveOp?**: `QvacOpResolver`

Override the default op resolver.

***

### sdk?

> `readonly` `optional` **sdk?**: [`QvacSdkLike`](QvacSdkLike.md)

QVAC SDK (or structural equivalent) to wrap. Optional — see `sdkLoader`.
Most consumers can skip this and supply `sdkLoader`, or install
`@qvac/sdk` and rely on the lazy default load.

***

### sdkLoader?

> `readonly` `optional` **sdkLoader?**: () => [`QvacSdkLike`](QvacSdkLike.md) \| `Promise`\<[`QvacSdkLike`](QvacSdkLike.md)\>

Async SDK loader, used when `sdk` is not provided. The idiomatic form is
`() => import('@qvac/sdk')`. If neither `sdk` nor `sdkLoader` is given,
the provider attempts `require('@qvac/sdk')` lazily at first use and
returns UNAVAILABLE when the package is not installed.

Injection via `sdk`/`sdkLoader` keeps the adapter testable and lets
runtimes supply a custom surface without the heavy native dependency tree.

#### Returns

[`QvacSdkLike`](QvacSdkLike.md) \| `Promise`\<[`QvacSdkLike`](QvacSdkLike.md)\>

***

### usageExtractor?

> `readonly` `optional` **usageExtractor?**: [`QvacUsageExtractor`](../type-aliases/QvacUsageExtractor.md)

Override the DSL op→usage mapping used by the provider.
