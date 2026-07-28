[**@totemsdk/se-server**](../index.md)

***

[@totemsdk/se-server](../index.md) / createSeServer

# Function: createSeServer()

> **createSeServer**(`config`, `monitorOpts?`): [`SeServer`](../interfaces/SeServer.md)

Create a fully configured SE server.

Runs `migrateStatechainTables` on first `listen()` call.
The returned `app` can also be mounted into an existing Express app
at any path if you prefer not to bind a new port.

## Parameters

### config

[`SeServerConfig`](../interfaces/SeServerConfig.md)

### monitorOpts?

`TimelockMonitorOptions`

## Returns

[`SeServer`](../interfaces/SeServer.md)
