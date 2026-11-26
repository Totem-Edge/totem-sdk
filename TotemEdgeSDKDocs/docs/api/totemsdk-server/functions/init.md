[**@totemsdk/server**](../index.md)

***

[@totemsdk/server](../index.md) / init

# Function: init()

> **init**(`_options?`): `Promise`\<`void`\>

Compatibility initializer for the synchronous bridge.

The CJS/sync build has already instantiated WASM at module load; this exists
so the public ESM and CJS APIs expose the same `init()` contract. The ESM
build rewrites this module to `wasm-async.js`, where init is the real
wasm-bindgen initializer.

## Parameters

### \_options?

#### module_or_path?

`unknown`

## Returns

`Promise`\<`void`\>
