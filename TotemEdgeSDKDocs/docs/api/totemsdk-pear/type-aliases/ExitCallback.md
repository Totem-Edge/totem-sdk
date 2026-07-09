[**@totemsdk/pear**](../index.md)

***

[@totemsdk/pear](../index.md) / ExitCallback

# Type Alias: ExitCallback

> **ExitCallback** = () => `void` \| `Promise`\<`void`\>

@totemsdk/pear — App lifecycle

`createPearApp` registers teardown handlers with the Pear runtime (when
present). `onExit` queues cleanup callbacks invoked in LIFO order on shutdown.

In non-Pear environments (Node.js, Bare without Pear), callers can trigger
shutdown manually via `runExitHandlers()`.

Bare-compatible: no `process.env`, no `__dirname`, no `require`.
Guards against `globalThis.Pear` being absent (tests, Node.js CI).

Registration semantics:
- `teardown` callback (`runExitHandlers`) is registered **once** with
  `Pear.teardown` — Pear only supports a single teardown hook, so multiple
  `createPearApp` calls do not double-register it.
- `onUpdate` callbacks are registered **every time** `createPearApp` is
  called with a non-null `onUpdate` — callers may legitimately update the
  handler between Pear hot-reloads and registering again is safe.

## Returns

`void` \| `Promise`\<`void`\>
