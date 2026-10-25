[**@totemsdk/omnia-relay**](../index.md)

***

[@totemsdk/omnia-relay](../index.md) / createRelayOmniaOperations

# Function: createRelayOmniaOperations()

> **createRelayOmniaOperations**(`options`): [`RelayOmniaOperations`](../interfaces/RelayOmniaOperations.md)

Local channel operations backed by the wallet's signing material — the port of
`@totemsdk/omnia-host`'s `openChannel`/`pay`/`settle`/`closeChannel` handlers
(RFC-014 §6.3), browser-safe (no SQLite/RPC/Node builtins).

`openChannel` expects the wallet/dApp to supply `fundingWitnessHex` (the signed
funding-input witness) — the wallet signs the funding transaction itself.

## Parameters

### options

[`RelayOmniaOperationsOptions`](../interfaces/RelayOmniaOperationsOptions.md)

## Returns

[`RelayOmniaOperations`](../interfaces/RelayOmniaOperations.md)
