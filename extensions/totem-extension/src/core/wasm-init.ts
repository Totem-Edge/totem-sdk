import { init } from '@totemsdk/core/wasm-async';

let coreWasmPromise: Promise<unknown> | null = null;

/**
 * Initialize the Totem core WASM kernel once per extension context.
 *
 * `@totemsdk/core` 1.4 uses the async-init web WASM build. Extension pages and
 * the service worker bundle it with webpack, so the wasm file is copied to the
 * extension root and loaded via chrome.runtime.getURL.
 */
export function ensureCoreWasm(): Promise<unknown> {
  if (!coreWasmPromise) {
    const url =
      typeof chrome !== 'undefined' && chrome.runtime?.getURL
        ? chrome.runtime.getURL('totemsdk_core_wasm_bg.wasm')
        : undefined;
    coreWasmPromise = init(url ? { module_or_path: url } : undefined).catch((error) => {
      coreWasmPromise = null;
      throw error;
    });
  }
  return coreWasmPromise;
}
