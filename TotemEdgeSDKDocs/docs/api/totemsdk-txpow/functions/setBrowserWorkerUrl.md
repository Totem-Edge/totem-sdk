[**@totemsdk/txpow**](../index.md)

***

[@totemsdk/txpow](../index.md) / setBrowserWorkerUrl

# Function: setBrowserWorkerUrl()

> **setBrowserWorkerUrl**(`url`): `void`

Configure the URL of the browser.worker.js bundle so that `mineTxPoW()`
can spawn a Web Worker in browser contexts.

Call this once at extension/dApp startup. The bundled worker file exposes
the same message protocol as node.worker.ts.

## Parameters

### url

`string`

## Returns

`void`

## Example

```ts
import { setBrowserWorkerUrl } from '@totemsdk/txpow';
  setBrowserWorkerUrl(browser.runtime.getURL('mine-worker.js'));
```
