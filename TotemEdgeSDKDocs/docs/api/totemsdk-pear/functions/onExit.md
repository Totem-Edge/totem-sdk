[**@totemsdk/pear**](../index.md)

***

[@totemsdk/pear](../index.md) / onExit

# Function: onExit()

> **onExit**(`cb`): [`Unsubscribe`](../type-aliases/Unsubscribe.md)

Register a cleanup callback to be called on app shutdown.
Callbacks are called in **LIFO** (last-in-first-out) order so that
higher-level clients are torn down before lower-level transports.

Returns an unsubscribe function that removes the callback.

## Parameters

### cb

[`ExitCallback`](../type-aliases/ExitCallback.md)

## Returns

[`Unsubscribe`](../type-aliases/Unsubscribe.md)
