[**@totemsdk/pear**](../index.md)

***

[@totemsdk/pear](../index.md) / PearApp

# Interface: PearApp

## Properties

### onExit

> **onExit**: (`cb`) => [`Unsubscribe`](../type-aliases/Unsubscribe.md)

Register a cleanup callback. Shorthand for the module-level `onExit`.

Register a cleanup callback to be called on app shutdown.
Callbacks are called in **LIFO** (last-in-first-out) order so that
higher-level clients are torn down before lower-level transports.

Returns an unsubscribe function that removes the callback.

#### Parameters

##### cb

[`ExitCallback`](../type-aliases/ExitCallback.md)

#### Returns

[`Unsubscribe`](../type-aliases/Unsubscribe.md)

***

### runExitHandlers

> **runExitHandlers**: () => `Promise`\<`void`\>

Manually trigger all registered exit handlers.

Run all registered exit callbacks in LIFO order.
Called automatically by Pear teardown when inside a Pear app.
Can also be called manually (e.g. on SIGTERM in standalone Node.js).

#### Returns

`Promise`\<`void`\>
