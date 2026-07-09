[**@totemsdk/pear**](../index.md)

***

[@totemsdk/pear](../index.md) / createPearApp

# Function: createPearApp()

> **createPearApp**(`config?`): [`PearApp`](../interfaces/PearApp.md)

Initialise the Pear runtime integration.

- Registers `runExitHandlers` with `globalThis.Pear.teardown` **once**
  (idempotent; safe to call on every app init).
- Registers the `onUpdate` handler **every time** a non-null handler is
  provided — the handler is not guarded so it can be refreshed.
- Safe to call in environments without `globalThis.Pear` (Node.js, bare
  without Pear) — no-op for the Pear-specific parts.

## Parameters

### config?

[`PearAppConfig`](../interfaces/PearAppConfig.md) = `{}`

## Returns

[`PearApp`](../interfaces/PearApp.md)
