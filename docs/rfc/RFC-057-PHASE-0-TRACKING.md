# RFC-057 Phase 0 — Tracking

Status: **started 2026-10-22** — D1, D7, D13 landed. D2–D6, D8–D12 pending.
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
| D2 | `pear` `BareHyperswarm.connect()` per-call listener, no topic match/cleanup | Pending | Needs the shared connection manager. |
| D3 | `openRemoteDrive()` joins the root key, not `drive.discoveryKey` | Pending | Use `drive.discoveryKey` for discovery; keep root key for `new Hyperdrive`. |
| D4 | `swarm.flush()` treated as peer readiness | Pending | Wait for a `connection`/core `update` with timeout. |
| D5 | `loadManifest()` imports nonexistent `@totemsdk/app-manifest`; catch-all returns raw JSON | Pending | Use `@totemsdk/manifest` decoder/verifier; fail closed; distinguish no-decoder vs invalid. |
| D6 | `loadManifest()` leaks a drive it opened | Pending | Close in `finally` when the function owns the drive. |
| D7 | `BareKVStore` uses `valueEncoding: 'json'` (no shared codec) | **Fixed** | `valueEncoding: 'binary'` + `@totemsdk/storage` codec; bigint/bytes test added. |
| D8 | `BareKVStore` tests inject a mocked Hyperbee only | Pending | Add real Hypercore/Hyperbee multi-peer Node tests. |
| D9 | `watch()` uses callback API | Pending | Pin Hyperdrive range; use async watcher. |
| D10 | `lookup-client` per-call swarm/listener leak | Pending | Shared connection manager; match peer/topic; destroy on failure. |
| D11 | `stream-transport` per-call swarm, `flush()` readiness, close only socket | Pending | Own swarm lifecycle; teardown/timeout tests. |
| D12 | Bare KV tests inject `:memory:` Hyperbee mock | Pending | Real Hypercore/Hyperbee under Node and Bare. |
| D13 | Android starter imports removed `@totemsdk/omnia-hyperswarm` | **Fixed** | Migrated to `@totemsdk/omnia`. |

## Next slices (in order)

1. **D3/D4/D6** — Hyperdrive discovery/readiness/lifecycle (localized, no new
   manager).
2. **D5** — manifest decode/verify fail-closed (add `@totemsdk/manifest` dep to
   `pear`; verify `/manifest.json` as a signed manifest, refuse invalid).
3. **D2/D10/D11** — shared Corestore/Hyperswarm connection manager with explicit
   ownership (`stream-transport` + `pear/network` + `lookup-client`).
4. **D8/D12** — real two-process Hypercore/Hyperbee tests (Node and Bare).
5. **D9** — Hyperdrive watcher interface pinning.

Gate (unchanged from RFC-057): Node and Bare both pass the two-process tests; no
mocked-Hyperbee test is the sole coverage for replication; lookup-client and
stream-transport pass teardown/timeout tests.

## Verification so far

- `@totemsdk/pear` — 34 tests pass (including the new D7 codec round-trip).
- `@totemsdk/lookup-node` — 63 tests pass (including the new D1 join mapping).
- `@totemsdk/pear` and `@totemsdk/lookup-node` build clean.
- Android starter imports `@totemsdk/omnia` (D13).
