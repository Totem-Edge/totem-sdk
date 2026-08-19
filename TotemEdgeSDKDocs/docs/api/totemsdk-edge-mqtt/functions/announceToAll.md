[**@totemsdk/edge-mqtt**](../index.md)

***

[@totemsdk/edge-mqtt](../index.md) / announceToAll

# Function: announceToAll()

> **announceToAll**(`runtimes`, `params`): `Promise`\<`EdgeOperationResult`\<`unknown`\>[]\>

Announce to every lookup port in the provided list of runtimes.

Each announce is attempted independently — a failure on one runtime does not
block the others. Returns an array of results in the same order as `runtimes`.

Typical use: a gateway that is connected to multiple lookup nodes and wants
to be discoverable on all of them without multiple call sites.

## Parameters

### runtimes

`EdgeRuntime`[]

### params

`AnnounceParams`

## Returns

`Promise`\<`EdgeOperationResult`\<`unknown`\>[]\>
