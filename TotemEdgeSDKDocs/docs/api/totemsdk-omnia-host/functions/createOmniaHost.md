[**@totemsdk/omnia-host**](../index.md)

***

[@totemsdk/omnia-host](../index.md) / createOmniaHost

# Function: createOmniaHost()

> **createOmniaHost**(`config`, `dependencies?`): [`OmniaHost`](../interfaces/OmniaHost.md)

Phase-1 lifecycle shell. Subsystems will be attached in later phases while
preserving idempotent startup and shutdown for the CLI and embedding users.

## Parameters

### config

[`OmniaHostConfig`](../interfaces/OmniaHostConfig.md)

### dependencies?

`OmniaHostDependencies` = `{}`

## Returns

[`OmniaHost`](../interfaces/OmniaHost.md)
