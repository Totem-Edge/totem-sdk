/**
 * Initialize the async-first core WASM bridge for Node tests.
 *
 * @totemsdk/core imports `@totemsdk/core-wasm/web` and needs a one-time
 * init() before any crypto call; the web loader fetches a URL that undici
 * cannot read from file://, so the bytes are handed to init directly.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const workspace = new URL('../../../../', import.meta.url);

export async function initCoreWasm() {
  const coreWasmWeb = join(
    new URL('packages/core-wasm/pkg-web/totemsdk_core_wasm.js', workspace).pathname,
  );
  const wasm = await import(pathToFileURL(coreWasmWeb).href);
  const wasmBytes = readFileSync(
    join(new URL('packages/core-wasm/pkg-web/totemsdk_core_wasm_bg.wasm', workspace).pathname),
  );
  await wasm.default({ module_or_path: wasmBytes });
}
