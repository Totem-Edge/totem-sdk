/**
 * WASM bootstrap for @totemsdk/core.
 *
 * Since RFC-031 the ESM entry of @totemsdk/core is backed by the wasm-bindgen
 * "web" artifact (@totemsdk/core-wasm/web), which does NOT self-initialise —
 * it requires a one-time `await init()` before any crypto call. Without it the
 * module instance is undefined and every call throws
 *   TypeError: Cannot read properties of undefined (reading '__wbindgen_malloc')
 *
 * This must run once per JS realm: the main thread and each Web Worker have
 * their own module instance, so both call `ensureWasm()`.
 */
import { init } from '@totemsdk/core/wasm';

let ready: Promise<unknown> | null = null;

/** Idempotently initialise the WASM core; safe to call from anywhere. */
export function ensureWasm(): Promise<void> {
  if (ready === null) {
    ready = init();
  }
  return ready.then(() => undefined);
}
