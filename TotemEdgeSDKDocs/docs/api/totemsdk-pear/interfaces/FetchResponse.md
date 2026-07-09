[**@totemsdk/pear**](../index.md)

***

[@totemsdk/pear](../index.md) / FetchResponse

# Interface: FetchResponse

BareFetch — thin fetch-compatible polyfill for Bare/Pear environments.

In Pear/Bare, native `fetch` may be absent. This module provides a
`fetch`-compatible function backed by `bare-http1` (or `bare-http2`).

Usage:
  import { bareFetch as fetch } from '@totemsdk/pear/network';
  const res = await fetch('https://api.example.com/data');
  const json = await res.json();

When native `globalThis.fetch` is present (Node 18+, browsers) it is used
directly. The polyfill is only activated when `fetch` is absent.

Bare-compatible: no `process.env`, no `__dirname`, no `require`.

## Properties

### headers

> **headers**: `Record`\<`string`, `string`\>

***

### ok

> **ok**: `boolean`

***

### status

> **status**: `number`

***

### statusText

> **statusText**: `string`

## Methods

### arrayBuffer()

> **arrayBuffer**(): `Promise`\<`ArrayBuffer`\>

#### Returns

`Promise`\<`ArrayBuffer`\>

***

### json()

> **json**\<`T`\>(): `Promise`\<`T`\>

#### Type Parameters

##### T

`T` = `unknown`

#### Returns

`Promise`\<`T`\>

***

### text()

> **text**(): `Promise`\<`string`\>

#### Returns

`Promise`\<`string`\>
