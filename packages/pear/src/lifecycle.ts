/**
 * @totemsdk/pear — App lifecycle
 *
 * `createPearApp` registers teardown handlers with the Pear runtime (when
 * present). `onExit` queues cleanup callbacks invoked in LIFO order on shutdown.
 *
 * In non-Pear environments (Node.js, Bare without Pear), callers can trigger
 * shutdown manually via `runExitHandlers()`.
 *
 * Bare-compatible: no `process.env`, no `__dirname`, no `require`.
 * Guards against `globalThis.Pear` being absent (tests, Node.js CI).
 *
 * Registration semantics:
 * - `teardown` callback (`runExitHandlers`) is registered **once** with
 *   `Pear.teardown` — Pear only supports a single teardown hook, so multiple
 *   `createPearApp` calls do not double-register it.
 * - `onUpdate` callbacks are registered **every time** `createPearApp` is
 *   called with a non-null `onUpdate` — callers may legitimately update the
 *   handler between Pear hot-reloads and registering again is safe.
 */

export type ExitCallback = () => void | Promise<void>;
export type Unsubscribe = () => void;

const _exitCallbacks: ExitCallback[] = [];

/** Guards: teardown is registered at most once per Pear runtime lifetime. */
let _pearTeardownRegistered = false;

/**
 * Register a cleanup callback to be called on app shutdown.
 * Callbacks are called in **LIFO** (last-in-first-out) order so that
 * higher-level clients are torn down before lower-level transports.
 *
 * Returns an unsubscribe function that removes the callback.
 */
export function onExit(cb: ExitCallback): Unsubscribe {
  _exitCallbacks.push(cb);
  return () => {
    const idx = _exitCallbacks.lastIndexOf(cb);
    if (idx >= 0) _exitCallbacks.splice(idx, 1);
  };
}

/**
 * Run all registered exit callbacks in LIFO order.
 * Called automatically by Pear teardown when inside a Pear app.
 * Can also be called manually (e.g. on SIGTERM in standalone Node.js).
 */
export async function runExitHandlers(): Promise<void> {
  for (let i = _exitCallbacks.length - 1; i >= 0; i--) {
    try {
      await _exitCallbacks[i]();
    } catch {
      // Teardown errors are non-fatal; continue with remaining handlers
    }
  }
}

export interface PearAppConfig {
  /**
   * Called when Pear signals the app should update (swap to a new version).
   * This callback is registered on every `createPearApp` call that supplies it,
   * allowing the handler to be refreshed across hot-reloads.
   * If absent, the default Pear behaviour applies.
   */
  onUpdate?: () => void | Promise<void>;
}

export interface PearApp {
  /** Register a cleanup callback. Shorthand for the module-level `onExit`. */
  onExit: typeof onExit;
  /** Manually trigger all registered exit handlers. */
  runExitHandlers: typeof runExitHandlers;
}

/**
 * Initialise the Pear runtime integration.
 *
 * - Registers `runExitHandlers` with `globalThis.Pear.teardown` **once**
 *   (idempotent; safe to call on every app init).
 * - Registers the `onUpdate` handler **every time** a non-null handler is
 *   provided — the handler is not guarded so it can be refreshed.
 * - Safe to call in environments without `globalThis.Pear` (Node.js, bare
 *   without Pear) — no-op for the Pear-specific parts.
 */
export function createPearApp(config: PearAppConfig = {}): PearApp {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pear = (globalThis as any).Pear as
    | {
        teardown?: (cb: () => void | Promise<void>) => void;
        updates?: (cb: () => void | Promise<void>) => void;
      }
    | undefined;

  if (pear) {
    // Register teardown exactly once
    if (!_pearTeardownRegistered) {
      _pearTeardownRegistered = true;
      pear.teardown?.(runExitHandlers);
    }
    // Register update handler on every call that provides one — intentionally
    // NOT guarded by _pearTeardownRegistered so it can be refreshed
    if (config.onUpdate) {
      pear.updates?.(config.onUpdate);
    }
  }

  return { onExit, runExitHandlers };
}

/** @internal — for testing: resets module-level state */
export function _resetForTesting(): void {
  _exitCallbacks.length = 0;
  _pearTeardownRegistered = false;
}
