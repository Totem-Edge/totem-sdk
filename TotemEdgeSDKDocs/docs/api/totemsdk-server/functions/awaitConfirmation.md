[**@totemsdk/server**](../index.md)

***

[@totemsdk/server](../index.md) / awaitConfirmation

# Function: awaitConfirmation()

> **awaitConfirmation**(`params`): `Promise`\<[`ConfirmResult`](../interfaces/ConfirmResult.md)\>

Poll the provider until `txpowId` is included in a block, the timeout elapses,
or the signal aborts.

## Parameters

### params

[`ConfirmParams`](../interfaces/ConfirmParams.md)

## Returns

`Promise`\<[`ConfirmResult`](../interfaces/ConfirmResult.md)\>
