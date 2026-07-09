[**@totemsdk/pear**](../index.md)

***

[@totemsdk/pear](../index.md) / runExitHandlers

# Function: runExitHandlers()

> **runExitHandlers**(): `Promise`\<`void`\>

Run all registered exit callbacks in LIFO order.
Called automatically by Pear teardown when inside a Pear app.
Can also be called manually (e.g. on SIGTERM in standalone Node.js).

## Returns

`Promise`\<`void`\>
