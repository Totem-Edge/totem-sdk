# RFC-057 Phase 0 — Tracking

Status: **Phase 0 complete 2026-10-26** — D1–D13 fixed; real two-process Node tests and the Node-proxy Bare suite pass. A native Bare runtime run remains environment-gated (no Bare binary in the default CI image).
Parent: [`RFC-057-DISTRIBUTED-STORAGE-AND-REPLICATION.md`](./RFC-057-DISTRIBUTED-STORAGE-AND-REPLICATION.md)

## Persistence boundary (non-negotiable)

RFC-057 does **not** move local persistence into Holepunch. The boundary is:

| What | Where it persists | Authority |
|---|---|---|
| Local transactional state (channels, operations, observation journal, leases, watermarks) | **`@totemsdk/storage`** — `SyncSqliteStore`/`SqliteStore`/`FileStore`/`MemoryStore`/`IdbStore` + `createJournal`/CAS/`ArtifactStore` | authoritative; atomic + durably acknowledged (RFC-007) |
| Replicated logs / indexes / collaborative state / artifact bytes | **`@totemsdk/replication`** contracts + **`@totemsdk/replication-holepunch`** adapters (Hypercore/Hyperbee/Autobase/Hyperdrive/Corestore) | eventually replicated / eventually convergent; **never** finality |
| `@totemsdk/pear` `BareKVStore` | Hyperbee (Hypercore) as the **replicated backing log**, values encoded with the **`@totemsdk/storage` versioned codec** (D7) | replicated adapter, not local transactional storage |
| `@totemsdk/storage` itself | runtime-neutral: SQLite/FS/IDB/memory only | must not acquire Hypercore/Pear/network deps |

Rules:
- A replication append is **locally persisted**, not remotely acknowledged and
  not final.
- Omnia/statechain/WOTS state may be replicated only as encrypted
  backups/recovery of already validated state — never as the authoritative
  state machine.
- Hyperbee/Autobase do not replace SQLite/CAS; `@totemsdk/storage` remains the
  local durability layer.

## Defect status

| # | Defect | Status | Notes |
|---|---|---|---|
| D1 | `lookup-node` uses legacy `swarm.join({ announce, lookup })` | **Fixed** | Maps to `{ server: announce, client: lookup }`; test added (`hyperswarm-manager.test.ts`). |
| D2 | `pear` `BareHyperswarm.connect()` per-call listener, no topic match/cleanup | **Fixed** | Uses `SwarmConnectionManager`; tests `pear/src/__tests__/hyperswarm.test.ts`, `stream-transport/src/__tests__/swarm-connection-manager.test.ts`. |
| D3 | `openRemoteDrive()` joins the root key, not `drive.discoveryKey` | **Fixed** | Joins `drive.discoveryKey`; root key still opens the drive. Test `pear/src/__tests__/hyperdrive.test.ts`. |
| D4 | `swarm.flush()` treated as peer readiness | **Fixed** | `waitForPeer()` resolves only on a real `connection`; `flush()` is announcement-only. Timeout destroys swarm/store. Tested in `hyperdrive.test.ts`. |
| D5 | `loadManifest()` imports nonexistent `@totemsdk/app-manifest`; catch-all returns raw JSON | **Fixed** | `verifyManifest` from `@totemsdk/manifest`; invalid JSON/envelope/signature throws. Tests in `hyperdrive.test.ts`. |
| D6 | `loadManifest()` leaks a drive it opened | **Fixed** | Owned drives close in `finally` (drive + swarm + store). Caller-supplied adapters are not closed. Tested. |
| D7 | `BareKVStore` uses `valueEncoding: 'json'` (no shared codec) | **Fixed** | `valueEncoding: 'binary'` + `@totemsdk/storage` codec; bigint/bytes test added. |
| D8 | `BareKVStore` tests inject a mocked Hyperbee only | **Fixed** | Real Hypercore/Hyperbee two-peer replication in `pear/src/__tests__/storage-hyperbee.test.ts`. |
| D9 | `watch()` uses callback API | **Fixed** | Async `drive.watch()` iterator with destroy-on-unsubscribe (Hyperdrive 13). Tested in `hyperdrive.test.ts`. |
| D10 | `lookup-client` per-call swarm/listener leak | **Fixed** | Uses `SwarmConnectionManager`; closes the manager before WS fallback. Test `lookup-client/src/__tests__/swarm-transport.test.ts`. |
| D11 | `stream-transport` per-call swarm, `flush()` readiness, close only socket | **Fixed** | `createHyperswarmTransport` owns a manager; `transport.close()` destroys swarm/topics. Tests `swarm-connection-manager.test.ts`. |
| D12 | Bare KV tests inject `:memory:` Hyperbee mock | **Fixed (Node + Node-proxy Bare)** | Real replication in `pear/src/__tests__/bare/hyperbee.bare.mjs`; native Bare run remains environment-gated. |
| D13 | Android starter imports removed `@totemsdk/omnia-hyperswarm` | **Fixed** | Migrated to `@totemsdk/omnia`. |

## Next slices

Phase 0 has no remaining defects. Phases 1–5 (replicated logs, indexes,
collaborative state) remain **proposed** and are not authorised by RFC-057.

## Verification (2026-10-26)

- `@totemsdk/stream-transport` — 27 tests pass, including connection-manager
  topic matching, timeout teardown and owned-swarm close.
- `@totemsdk/pear` — 45 Node tests + 18 Node-proxy Bare tests pass, including
  real two-peer Hypercore/Hyperbee replication.
- `@totemsdk/lookup-client` — 32 tests pass, including swarm teardown on a
  failed connection.
- `pnpm --filter @totemsdk/pear run test:bare` — storage, lifecycle and real
  Hyperbee suites pass.
