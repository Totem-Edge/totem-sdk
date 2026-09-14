[**@totemsdk/intelligence**](../index.md)

***

[@totemsdk/intelligence](../index.md) / IntelligenceProviderOptions

# Interface: IntelligenceProviderOptions

Constructor options shared by provider adapters.

## Properties

### defaultTimeoutMs?

> `readonly` `optional` **defaultTimeoutMs?**: `number`

Timeout for individual operations (ms). Default provider-specific.

***

### lazyConnect?

> `readonly` `optional` **lazyConnect?**: `boolean`

Auto-connect on construction. Defaults to true.

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
