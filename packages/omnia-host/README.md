# @totemsdk/omnia-host

The Omnia host daemon will provide durable channel lifecycle, routing, chain
integration, and control APIs for a Totem node. Phase 1 contains the package
and lifecycle scaffold; subsystem implementations are added incrementally.

## Run

```bash
OMNIA_CHAIN_RPC_PASSWORD=secret pnpm --filter @totemsdk/omnia-host build
OMNIA_CHAIN_RPC_PASSWORD=secret pnpm --filter @totemsdk/omnia-host start
```

The daemon configuration is read from environment variables:

| Variable | Default | Purpose |
| --- | --- | --- |
| `OMNIA_HOST_PORT` | `50052` | Host control and health port |
| `OMNIA_HOST_DB` | `~/.totem/omnia/omnia.sqlite` | Durable channel database |
| `OMNIA_CHAIN_RPC` | `http://127.0.0.1:9005` | Totem node RPC endpoint |
| `OMNIA_CHAIN_RPC_PASSWORD` | unset | Totem node RPC password |
| `OMNIA_ANALYTICS_DB` | unset | Optional DuckDB analytics path |
| `OMNIA_RELAY` | native swarm | Optional relay URL |
| `OMNIA_LOCAL_PUBKEY` | unset | Local Omnia identity |
| `OMNIA_LOCAL_PARTY_ID` | unset | Local channel party ID required for mutations |
| `OMNIA_LOCAL_ADDRESS_INDEX` | unset | Local WOTS address index |
| `OMNIA_LOCAL_SETTLEMENT_ADDRESS` | unset | Default cooperative settlement address |

The daemon is intended to run beside `totem-node -mode omnia` or `-mode full`.
The current implementation includes the swarm lifecycle wiring, SQLite and
operation-store abstractions, JSON-RPC/WebSocket control API, route provider,
chain adapter, Edge adapter contract, optional Go-router boundary, and DuckDB
analytics abstraction. Funding/signing mutations remain capability-gated until
a signer and WOTS lease provider are supplied.

The local test environment may skip SQLite integration tests when the
`better-sqlite3` native addon has not been built. Install lifecycle scripts in
CI or on the target platform to execute those tests.
