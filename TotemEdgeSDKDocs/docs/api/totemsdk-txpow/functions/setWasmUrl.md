[**@totemsdk/txpow**](../index.md)

***

[@totemsdk/txpow](../index.md) / setWasmUrl

# Function: setWasmUrl()

> **setWasmUrl**(`url`): `void`

Configure the URL from which the browser loads `miner.wasm`.

Call this once at app startup in browser contexts. The extension build
(Task #114) resolves this URL from the bundler's output.

## Parameters

### url

`string`

## Returns

`void`

## Example

```ts
import { setWasmUrl } from '@totemsdk/txpow';
  setWasmUrl(browser.runtime.getURL('miner.wasm'));
```
