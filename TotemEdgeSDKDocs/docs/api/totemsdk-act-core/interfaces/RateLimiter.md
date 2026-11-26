[**@totemsdk/act-core**](../index.md)

***

[@totemsdk/act-core](../index.md) / RateLimiter

# Interface: RateLimiter

## Methods

### consume()

> **consume**(`key`, `limit`): `Promise`\<[`RateLimitResult`](RateLimitResult.md)\>

#### Parameters

##### key

`string`

##### limit

[`RateLimit`](RateLimit.md)

#### Returns

`Promise`\<[`RateLimitResult`](RateLimitResult.md)\>

***

### peek()

> **peek**(`key`, `limit`): `Promise`\<[`RateLimitResult`](RateLimitResult.md)\>

#### Parameters

##### key

`string`

##### limit

[`RateLimit`](RateLimit.md)

#### Returns

`Promise`\<[`RateLimitResult`](RateLimitResult.md)\>
