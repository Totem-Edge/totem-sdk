# Bare / Bun readiness — package matrix and port plan

**Date:** 2026-10-03
**Scope:** all 64 workspace packages against the Holepunch **Bare/Pear** runtime and the **Bun** runtime
**Method:** static scan of each package's `src` (excluding `__tests__`) for Node builtins
(`node:*` and bare `fs`/`path`/`crypto`/`net`/`tls`/`worker_threads`/…) and native deps
(`better-sqlite3`, `hyperswarm`, `ws`); plus dynamic load tests under Bun (`bun -e` on built dists).

---

## 1. Summary

- **Bun-readiness is effectively already met.** Bun is Node-compatible: **every** Node-coupled
  package loaded successfully under Bun — `minima-rpc` (`net`/`tls`), `tx-builder`/`wots-lease`/
  `agent-policy` (`crypto`), `storage`/`lookup-node` (`better-sqlite3`), `txpow`
  (`worker_threads`/`fs`). The **only** failure was `@totemsdk/core`'s ESM path, and that is the
  bundler-target wasm glue (`wasm.__wbindgen_start is not a function`), not a Node builtin. Core's
  **CJS** path (190 exports) and **`@totemsdk/core/wasm-async`** both load fine on Bun.
- **Bare-readiness is a genuine refactor.** Bare provides no `node:*` builtins (it uses `bare-fs`,
  `bare-net`, `bare-crypto`, `bare-worker`, …), so 18 packages need porting; of those, 5 are
  Node-only servers that should be excluded from the Bare target.
- **One run is possible, and the efficient direction is Bare.** Port-based code (no `node:*`) runs
  on Bun too, so **Bare-readiness subsumes Bun-readiness**. Doing only Bun gets you almost nothing
  toward Bare.

## 2. Classification

Legend: **BARE** = no Node builtins/native deps (runs on Bare today) · **PORT** = needs porting for
Bare · **SERVER** = Node-only service, excluded from the Bare target (still runs on Bun).

| Package | Node coupling | Class |
|---|---|---|
| `@totemsdk/core` | `crypto` | **PORT** (crypto) |
| `@totemsdk/agent-policy` | `crypto` | **PORT** (crypto) |
| `@totemsdk/edge` | `crypto` | **PORT** (crypto) |
| `@totemsdk/edge-mqtt` | `crypto` | **PORT** (crypto) |
| `@totemsdk/kissvm` | `crypto` | **PORT** (crypto) |
| `@totemsdk/omnia` | `crypto` + `hyperswarm` | **PORT** (crypto/network) |
| `@totemsdk/proof-integritas` | `crypto` | **PORT** (crypto) |
| `@totemsdk/tx-builder` | `crypto` | **PORT** (crypto) |
| `@totemsdk/wots-lease` | `crypto` | **PORT** (crypto) |
| `@totemsdk/pubsub-transport` | `events` | **PORT** (minor) |
| `@totemsdk/minima-rpc` | `net`, `tls` | **PORT** (transport) |
| `@totemsdk/txpow` | `fs`, `path`, `worker_threads` | **PORT** (worker/fs) |
| `@totemsdk/storage` | `fs`, `path`, `better-sqlite3` | **PORT** (adapters only) |
| `@totemsdk/omnia-host` | `crypto,fs,http,net,os,path,child_process,readline` + `better-sqlite3`,`ws` | **SERVER** |
| `@totemsdk/se-server` | `crypto`, `http` | **SERVER** |
| `@totemsdk/server` | `crypto`, `events`, `path` + `ws` | **SERVER** |
| `@totemsdk/mcp-server` | `fs`, `path` | **SERVER** |
| `@totemsdk/lookup-node` | `crypto`, `events`, `stream` + `better-sqlite3` | **SERVER** |

**Bare-native (46):** `authority`, `chain-provider`, `connect`, `core-wasm`, `decision`,
`edge-adapters`, `edge-bacnet/ble/can/coap/email/grpc/lorawan/matter/modbus/nfc/opcua/ros2`,
`governance`, `identity`, `industrial-action`, `intelligence`, `liquidity-bond`, `location-proof`,
`lookup-client`, `lookup-protocol`, `manifest`, `omnia-factory/pool/router/splice/vtxo`, `pear`,
`proof`, `proofgraph`, `provider-bond`, `qvac`, `raster-proof`, `realtime`, `recursive-mast`,
`root-identity`, `spatial-proof`, `statechain`, `stream-transport`, `wallet-adapter`, `sdk-tests`.

## 3. The coupling is concentrated — one swap covers most of it

`node:crypto` is the dominant leak, and it is almost entirely **`randomBytes` / `createHash` /
`randomUUID` / `timingSafeEqual`** — all of which the **WASM core already provides** and which
works on Bare/Bun/browser/edge:

| API used | Packages |
|---|---|
| `createHash` | agent-policy, edge-mqtt, kissvm, omnia, wots-lease, server |
| `randomBytes` | core, kissvm, tx-builder, se-server, server |
| `randomUUID` | edge, proof-integritas, wots-lease |
| `timingSafeEqual` | core, kissvm |

Replacing `node:crypto` with the WASM core (`sha3_256`, `timingSafeEqual`, and a small
`randomBytes` from a `CryptoAdapter`/`bare-crypto`/`crypto.getRandomValues`) removes the leak from
**9 non-server packages at once** — and it is the same change the root-wasm-free work needs.

## 4. Prioritized port plan

### P1 — crypto → WASM core / `CryptoAdapter` (highest leverage)
**Packages:** core, agent-policy, edge, edge-mqtt, kissvm, omnia, proof-integritas, tx-builder, wots-lease.
**Change:** `createHash`→`sha3_256` (WASM), `timingSafeEqual`→WASM, `randomBytes`/`randomUUID`→a
`CryptoAdapter` port (Bare: `bare-crypto`; browser: `crypto.getRandomValues`; Node/Bun: `node:crypto`).
**Why first:** kills the biggest leak, unblocks 9 packages for Bare, and is shared with the
root-wasm-free migration. **Effort: ~1–2 weeks.**

**Status (2026-10-03): non-consensus scope complete.** Migrated off `node:crypto`:
`agent-policy` (sha256), `tx-builder` (random), `edge`/`proof-integritas` (randomUUID),
`wots-lease` (sha256 journal), `omnia` (sha256 idempotency). Remaining `node:crypto` is
**only** consensus-critical (`core/scripts/contract-helpers`, `kissvm/eval`, `kissvm/simulate`),
**server-only** (`omnia-host`, `lookup-node`, `server`, `se-server`), or **test mocks**
(`kissvm/__mocks__`, `edge-mqtt/wasm-jest-mock`). Consensus hashing stays on the oracle-parity WASM
core; a KISSVM `SHA2`/`SHA3` oracle-vector guard now pins the opcodes
(`packages/kissvm/src/__tests__/hash-opcodes.oracle.test.ts`).

**Status (2026-10-05): Fix A landed — wasm-free ESM root + consensus crypto ported.**
The remaining consensus-critical `node:crypto` is gone: `core/scripts/contract-helpers`
(SHA-256 → `@noble/hashes`, randomness → `globalThis.crypto`) and `kissvm` (SHA2 opcode →
`@noble/hashes`, simulation digest → WASM `sha3_256`) — both byte-exact and guarded by
`contract-helpers-crypto.test.ts` / `hash-opcodes.oracle.test.ts`. `@totemsdk/core` exposes
wasm-free `./bytes` and `./canonical` subpaths, and its **ESM build routes every crypto call to
the portable async bridge** (`packages/core/scripts/async-esm.mjs`), so the ESM root imports with
no WASM binary and runs on edge/Workers/Bare after a one-time `await init()`; the CJS root stays
sync. All non-server, non-test packages are dual ESM+CJS (the Node-only servers and `txpow`'s
CJS worker are intentionally left CJS). Remaining `node:crypto` is **server-only**
(`omnia-host`, `lookup-node`, `server`, `se-server`) or **test mocks**
(`kissvm/__mocks__`, `edge-mqtt/wasm-jest-mock`).

### P2 — transport / fs / worker ports
**Packages:** minima-rpc (`net`/`tls` → `bare-net`/`bare-tls`), txpow (`worker_threads`/`fs`/`path` →
`bare-worker`/`bare-fs`), storage (Node adapters behind the existing `StorageAdapter` port; Bare
already has `pear/storage` `BareKVStore`/`BareFileStore`), omnia (`hyperswarm` → network port, `pear/network`
already exists), pubsub-transport (`events` → `bare-events`).
**Effort: ~1–2 weeks.**

**Status (2026-10-03): complete.** `pubsub-transport` now uses an in-package
`EmitterLike` (no `node:events`). The rest were already guarded/abstracted:
`minima-rpc` (`try{require('node:net')}catch` → fetch-primary, raw net/tls optional),
`txpow` (`typeof process === 'undefined'` → no worker; wasm-fs path guarded),
`storage` (Node adapters behind `StorageAdapter`; `pear/storage` supplies Bare),
`omnia` (hyperswarm is a dynamic/optional import; relay mode is Bare-safe).

### P3 — Bun verification + core ESM wasm fix
**Change:** add a Bun job to CI that loads each package; resolve `@totemsdk/core`'s ESM path to the
**nodejs** target or `./wasm-async` under Bun (the bundler-target glue is the only Bun failure).
**Effort: ~2–4 days.**

**Status (2026-10-03): complete.** Added a `bun` export condition to
`@totemsdk/core-wasm` (`.`) pointing at the nodejs target, so Bun's ESM path resolves correctly while
browsers keep the bundler target. `scripts/verify-bun-load.mjs` loads **62/62** packages under Bun
(1.3.14); a `bun-readiness` CI job runs it.

### Excluded
`omnia-host`, `se-server`, `server`, `mcp-server`, `lookup-node` are Node services — keep Node-only
(they still run on Bun). Revisit only if a Bare server use-case appears.

## 5. Effort

| Goal | Work | Estimate |
|---|---|---|
| **Bun-only** | CI matrix + core ESM wasm resolution | **~2–4 days** (≈already done) |
| **Bare (Pear/mobile)** | P1 + P2 (13 non-server packages) | **~2–4 weeks** |
| **Both, one run** | P1 + P2 + P3 | **~3–5 weeks** (Bun comes free) |

## 6. Recommendation

Target **Bare-readiness via the port refactor (P1→P2)** and add **Bun verification (P3)** in the same
run. That yields both runtimes with one body of work, because port-based code is runtime-agnostic
and Bun already tolerates what Bare does not. Bun alone is nearly free but doesn't advance the
Pear/mobile goal; Bare alone is the real work and pulls Bun along.

**Sequencing:** P1 (crypto swap) first — highest leverage, shared with the root-wasm-free migration —
then P2 (transport/worker), then P3 (Bun CI). Gate each package with the full workspace verification.

---

## 7. Consensus classification of `node:crypto` call sites (P1 safety rule)

**Rule:** only **non-consensus** hashing and randomness may move to `@noble/hashes` /
`globalThis.crypto`. **Consensus-critical** hashing stays on the **oracle-parity WASM core**
(`@totemsdk/core`); on Bare it is reached through `@totemsdk/core/wasm-async` (same WASM core, so
parity is preserved). Changing a consensus site requires **C++/Java node oracle vectors**, not a
`node:crypto` comparison. WOTS, TreeKey, MMR, address derivation and transaction serialization are
**out of scope** for P1 and must not change.

| Call site | Use | Class | Action |
|---|---|---|---|
| `agent-policy/receipt-store.ts` `sha256` | receipt store key (`rcpt-…`) | **non-consensus** | ✅ moved to `@noble/hashes` |
| `tx-builder/multisig-manager.ts` `randomBytes` | local pending-tx id | **non-consensus** | ✅ moved to `globalThis.crypto` |
| `edge/intelligence-usage-journal.ts` `randomUUID` | request id | **non-consensus** | move to `globalThis.crypto` |
| `proof-integritas/provider.ts` `randomUUID` | request id | **non-consensus** | move to `globalThis.crypto` |
| `wots-lease/journal.ts` `sha256` | journal hash-chain (`previousHash`) | **non-consensus** | move to `@noble/hashes` |
| `omnia/intent.ts` `sha256` | idempotency `operationId` | **non-consensus** | move to `@noble/hashes` |
| `edge-mqtt/wasm-jest-mock.ts` `sha3-256` | **test mock only** | n/a | leave |
| `omnia` `createHash` / `getRandomValues` | audit each | **review** | classify before moving |
| **`kissvm/eval.ts` `sha2` (line 366)** | **KISSVM `SHA2`/`SHA3` opcode** | **CONSENSUS** | **do not move to noble** — keep WASM core; add oracle-vector guard |
| **`core/scripts/contract-helpers.ts` `sha256`** | **hashlock preimage → on-chain script** | **CONSENSUS** | **do not move** — WASM core / oracle vectors |
| **`kissvm/simulate.ts` `computeSimulationDigest`** | simulation `txDigest` | **CONSENSUS-adjacent** | keep WASM core; review before any change |
| `omnia-host/*`, `server/*`, `se-server/*`, `lookup-node/*` | server-only services | **SERVER** | excluded from Bare target |

**Guard to add:** an oracle-vector test pinning the KISSVM `SHA2` (SHA-256) and `SHA3` (SHA3-256)
opcodes against the C++/Java node, so a future refactor cannot silently diverge.

