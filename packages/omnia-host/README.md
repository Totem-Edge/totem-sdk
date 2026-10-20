# @totemsdk/omnia-host

The Omnia host daemon provides durable channel lifecycle, routing, chain
integration, and control APIs for a Totem node. With signing material
provisioned it runs fully operational; without it, it boots in read-only mode
(channel/route/health queries only).

## Run

```bash
OMNIA_HOST_SEED="your bip39 mnemonic or 0x…64-hex seed" \
OMNIA_CHAIN_RPC_PASSWORD=secret pnpm --filter @totemsdk/omnia-host build
OMNIA_HOST_SEED="your bip39 mnemonic or 0x…64-hex seed" \
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
| `OMNIA_HOST_SEED` | unset | BIP39 mnemonic or 32-byte hex seed for channel signing |
| `OMNIA_HOST_KEYFILE` | unset | Path to keyfile JSON (resolved against cwd); mutually exclusive with `OMNIA_HOST_SEED` |
| `OMNIA_HOST_KEYFILE_PASSPHRASE` | unset | Keyfile decryption passphrase (required for encrypted keyfiles) |
| `OMNIA_HOST_DEVICE_ID` | `device-<slot>` | Stable device id for the lease journal |
| `OMNIA_HOST_READ_ONLY` | unset | `1` forces read-only mode even with keys present |
| `OMNIA_HOST_IDENTITY_FILE` | unset | Optional delegated identity claim JSON (operator root → service delegate) |
| `OMNIA_HOST_SERVICE_TYPE` | `omnia-router` | EdgeServiceManifest serviceType |
| `OMNIA_P2P_HUB_PORT` | unset | Enable the RFC-062 loopback P2P hub on this port |
| `OMNIA_P2P_HUB_HOST` | `127.0.0.1` | Hub bind address; keep loopback unless explicitly remote |
| `OMNIA_P2P_HUB_TOKEN` | unset | Hub bearer token (use a per-client credential in production) |
| `OMNIA_P2P_HUB_ORIGINS` | unset | Comma-separated browser Origin allowlist |
| `OMNIA_P2P_HUB_TOPICS` | unset | Comma-separated topic prefixes (e.g. `omnia,dex.v1`) |

### Signing model

`OMNIA_HOST_SEED` (or the keyfile) is the base seed. The host derives the unified
child TreeKey (`createUnifiedChildTreeKey(baseSeed, localAddressIndex)`) and signs
every channel state (and the boot manifest) with serialized TreeSignatures; the
channel participant's `publicKeyDigest` is that TreeKey's root public key, and the
identity address is the matching Minima address. The WOTS lease journal and
watermark persist in `<OMNIA_HOST_DB>.lease/` so they survive restarts together
with the channel database.

### Read-only mode

Without `OMNIA_HOST_SEED`/`OMNIA_HOST_KEYFILE` (or with `OMNIA_HOST_READ_ONLY=1`)
the daemon logs `[omnia-host] no signing material; starting READ-ONLY` and
registers only `getChannels`, `getRoute`, `getSwapRate`, `whoami`, and
`getManifest`. Mutation methods are never registered without a signer.

### Identity + manifest (opt-in)

With signing material present, the daemon derives a service identity document
from the seed and signs a boot-time `EdgeServiceManifest` (serviceType from
`OMNIA_HOST_SERVICE_TYPE`). `OMNIA_HOST_IDENTITY_FILE` may supply a delegated
identity claim (operator root → service delegate) validated via
`verifyIdentityClaim`. Query them over JSON-RPC with `totem_omniaWhoami`
(`omnia/whoami`) and `totem_omniaGetManifest` (`omnia/getManifest`).

The daemon is intended to run beside `totem-node -mode omnia` or `-mode full`.
The current implementation includes the swarm lifecycle wiring, SQLite and
operation-store abstractions, JSON-RPC/WebSocket control API, route provider,
chain adapter, Edge adapter contract, optional Go-router boundary, DuckDB
analytics abstraction, env-provisioned signer + WOTS lease provider, and
multi-hop payment execution via `@totemsdk/omnia-router`.

The local test environment may skip SQLite integration tests when the
`better-sqlite3` native addon has not been built. Install lifecycle scripts in
CI or on the target platform to execute those tests.
