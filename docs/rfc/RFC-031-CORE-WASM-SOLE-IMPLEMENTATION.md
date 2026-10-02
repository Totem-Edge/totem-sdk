# RFC-031: Core-Wasm Sole-Implementation — Portable WASM, Parity Gates, and the Sunset of the JS Crypto Kernels

**Status:** Draft — P1 (portable WASM) + P2 (coverage matrix) in progress
**Created:** 2026-10-02
**Authors:** Totem SDK Contributors
**Depends on:** RFC-018 (WASM/TS serializer parity + provenance gate), RFC-020 (multi-package adversarial hardening), RFC-014 (wallet/edge bundling), `SECURITY.md` invariants
**Touches:** `@totemsdk/core`, `@totemsdk/core-wasm`, `@totemsdk/realtime`, `@totemsdk/connect`, `@totemsdk/txpow`, `@totemsdk/tx-builder`, `@totemsdk/wots-lease`, `@totemsdk/root-identity`, `@totemsdk/identity`, `@totemsdk/omnia`, `@totemsdk/statechain`, `@totemsdk/server`, `@totemsdk/pear`, `@totemsdk/mcp-server`, plus edge/Worker consumers
**Evidence:** import-graph + wasm-target inspection of `main` @ `d232b64` (see §4); parity suites `wots-parity`, `Streamable.parity`, `transaction.serializer-parity`, `perAddressDerivation.parity`, `core-wasm/tests/java_parity.rs`.

---

## 1. Summary

`@totemsdk/core` currently ships **two implementations of the same cryptographic and
serialization kernels**: a Rust/WASM implementation (`@totemsdk/core-wasm`, reached
through the sync bridge `@totemsdk/core/wasm`) and a TypeScript implementation
(the `@totemsdk/core/legacy` surface). The root entry eagerly re-exports the WASM
bridge, so *any* import of `@totemsdk/core` — even for an adapter constant — drags
a synchronous, bundler-target `.wasm` import (and, on the Node path, `fs`/`__dirname`)
into the module graph. That breaks stock-`esbuild` edge/Workers bundles and forces
consumers onto workarounds.

Dual implementations are not merely maintenance overhead: the drift between them is
a **security class** — the WASM/TS serializer divergence (RFC-018 P2-3) and the
MiniNumber scale / two's-complement loss (RFC-020 P2-10) were both dual-impl bugs.

This RFC defines the **gated, phased migration to a single WASM implementation**:
make `@totemsdk/core` wasm-free by default, make the WASM artifact portable to every
runtime the JS kernels serve (async init; no `fs`), prove byte-exact parity against
the C++/Java oracle, pin/provenance the artifact, and only then **remove the JS
kernels** in a major release. The sunset is **trigger-based, not date-based**: the
fallback cannot be retired until the primary works everywhere the fallback did.

## 2. Problem

### 2.1 Edge/Worker bundling is broken by the root's eager WASM coupling
`packages/core/src/index.ts` re-exports crypto from `./wasm-sync.js` (root `dist/index.js:20-36`).
`wasm-sync.ts` imports `@totemsdk/core-wasm` at module load and states "initialized
at import time". The bundler target's glue (`core-wasm/pkg/totemsdk_core_wasm.js:2-6`)
is:

```js
import * as wasm from "./totemsdk_core_wasm_bg.wasm";
__wbg_set_wasm(wasm);
wasm.__wbindgen_start();
```

Stock `esbuild` has no loader that turns `.wasm` into a `WebAssembly.Module`, so the
build fails. The Node target (`core-wasm/pkg-node/totemsdk_core_wasm.js`) uses
`require('fs').readFileSync(__dirname + …)` + `new WebAssembly.Module/Instance`,
which is fine unbundled in Node but breaks when bundled for a Worker (no `fs`).

**Observed blast radius:** `@totemsdk/realtime` imported the *value*
`WebSocketReadyState` from the root (`PortfolioStreamManager.ts:31`), pulling the
whole WASM graph into every consumer of realtime. This is fixed (P0) by importing
`@totemsdk/core/adapters` — which has **zero imports** and is wasm-free.

### 2.2 Two implementations drift
Every kernel exists twice (TS + Rust): WOTS, TreeKey, MMR, BIP39, address derivation,
script, Streamable, Java streamables, transaction serialization, `minima32`, params,
`verify`. Drift has already produced consensus-relevant defects (RFC-018/020). Two
implementations double the test surface and make "the same input produces the same
bytes" a permanent, fragile invariant.

### 2.3 The sync-at-import contract is fundamentally un-portable
`wasm-sync` promises synchronous crypto immediately after import. Edge runtimes
instantiate WASM asynchronously (or via a bundler-provided module), so a
sync-at-import WASM can never be the sole portable implementation without an
explicit init step.

## 3. Goals

1. Make **`@totemsdk/core` importable with no WASM dependency** (root = types,
   adapters, pure orchestration; crypto behind explicit subpaths).
2. Ship a **portable WASM** artifact: async `init()`, correct `web`/`nodejs`/`bundler`
   targets, optional embedded bytes, no `fs`/`__dirname` in bundled output — verified
   on Node (CJS+ESM), browser, Cloudflare Workers, Deno, Bun.
3. Prove **byte-exact parity** of every kernel against the external C++/Java oracle
   (never against the other SDK implementation), with property/fuzz coverage.
4. **Provenance**: reproducible, pinned, signed WASM artifacts with an SBOM and a CI
   gate that fails on drift.
5. **Retire the JS kernels** (`/legacy`) in a major release once G1–G4 hold, with a
   deprecation window and a documented migration path for sync callers.

## 4. Non-goals

- Removing `@totemsdk/core` itself. The package stays as the typed API, adapters,
  `LeaseStore`/`WatermarkStore`, `TransactionService`, witness-serializer/
  contract-helpers, params, and canonical-hashing glue.
- Replacing non-crypto TS with Rust.
- A runtime JS fallback after sunset (unless a genuinely non-WASM target must be
  supported; then it is a documented, frozen shim — not a parallel implementation).
- Changing the wire/serialization formats.

## 5. Current state (evidence)

| Surface | State |
|---|---|
| Root `@totemsdk/core` | Eagerly re-exports `./wasm-sync` (`index.ts:71-166`); pulls `core-wasm` at import |
| `@totemsdk/core/wasm` | Sync WASM bridge; "initialized at import time" |
| `@totemsdk/core/legacy` | Pure-JS kernels; JS names are **`legacy`-prefixed** (`legacyWotsSign`, …); not a drop-in |
| `@totemsdk/core/adapters` | Wasm-free, zero imports; `StorageAdapter`, `WebSocketFactory`, `WebSocketReadyState`, … |
| `core-wasm/pkg` (bundler) | `import * as wasm from "./….wasm"` + sync `__wbindgen_start()` |
| `core-wasm/pkg-node` (nodejs) | `fs.readFileSync` + `new WebAssembly.Module/Instance` |
| Rust kernels present | `wots`, `treekey`, `wasm_tree`, `mmr`, `bip39`, `minima32`, `derive`, `script`, `streamable`, `java_streamables`, `transaction`, `txpow_mine`, `verify`, `params` |
| Parity suites | `wots-parity`, `Streamable.parity`, `transaction.serializer-parity`, `perAddressDerivation.parity`, `java_parity.rs` |
| Provenance | RFC-018 WASM-provenance CI gate (foundation for G3) |

**Scope of the sunset:** the pure-JS kernels `wots.ts`, `treekey.ts`, `mmr.ts`,
`bip39.ts`, `minima32.ts`, `derive.ts`, `script.ts`, `Streamable.ts`,
`java_streamables.ts`, `transaction.ts` (the `/legacy` surface). `verify.ts` is
hybrid today (`sha3` from WASM, `wotsVerifyDigest` from JS) and moves fully to WASM.

## 6. Design

### 6.1 Target architecture

```
@totemsdk/core                      # wasm-free root: types, adapters, orchestration
  ./adapters                        # ports/types; zero imports (unchanged)
  ./wasm                            # async WASM crypto (single implementation)
  ./legacy                          # DEPRECATED → removed at P5
  ./lease ./tx ./scripts ./params   # orchestration; unchanged
```

- **Root never imports `core-wasm`.** Crypto is only reachable via `./wasm`
  (explicit) or, during the deprecation window, `./legacy`.
- **`./wasm` is async-first:** `import { init, wotsSign } from '@totemsdk/core/wasm';
  await init(); wotsSign(...)`. A Node-only synchronous variant may be offered
  (`./wasm/sync`) for CJS servers that cannot await at module scope.

### 6.2 Portable WASM (G1)

- Build `wasm-bindgen` targets `web` (async `init()` via `instantiateStreaming`/
  `WebAssembly.instantiate`) and `nodejs`, plus a **bundler-friendly** entry that
  accepts either an instantiated module or embedded bytes.
- Offer **embedded bytes** (`WebAssembly.Module(bytes)`) for runtimes that forbid
  network/streaming instantiation, gated behind an explicit entry.
- **No `fs`/`__dirname` in any bundled output.** The nodejs target is only for
  unbundled Node; document this and provide an esbuild-safe alternative.
- Publish a **runtime support matrix** and test it in CI: Node CJS, Node ESM,
  browser (Vite), Cloudflare Worker (wrangler), Deno, Bun.

### 6.3 Parity & oracle strategy (G2)

- Every kernel has byte-exact golden vectors generated from the **C++/Java node
  oracle**, committed and CI-checked; the JS implementation is never the reference.
- Property/fuzz tests for serialization round-trips (MiniNumber scale + sign,
  MMR-entry scale, state variables, tokens), WOTS sign/verify, TreeKey derivation,
  address/script hashing.
- A **coverage matrix** asserting no kernel is WASM-missing; a kernel that only
  exists in `/legacy` blocks the sunset.

### 6.4 Provenance & reproducibility (G3)

- Pin `rustc` and `wasm-bindgen`; deterministic build (`SOURCE_DATE_EPOCH`,
  `--locked`); publish artifact hashes + SBOM.
- CI gate: rebuild and fail on byte drift; verify the published `.wasm` hash matches
  the source-built artifact (extends the RFC-018 provenance gate).

### 6.5 API migration (G4)

- `await init()` once at process/isolate boot, then synchronous calls — preserves the
  ergonomics of the current sync API where the runtime allows it.
- For runtimes that cannot init at module scope, provide async wrappers.
- `/legacy` emits a one-time deprecation warning and is **frozen** (no new kernels).
- A codemod/guide maps `@totemsdk/core` → `@totemsdk/core/wasm` and
  `legacyWotsSign` → `wotsSign`.

## 7. Gates (the sunset trigger)

The JS kernels are removed **only when all four gates are green**:

| Gate | Acceptance |
|---|---|
| **G1 — Portable WASM** | Async `init()` works on the full runtime matrix (Node CJS/ESM, browser, Worker, Deno, Bun); no `fs`/`__dirname` in bundled output; embedded-bytes entry available |
| **G2 — Provable parity** | Byte-exact oracle vectors + fuzz for every kernel; coverage matrix shows zero legacy-only kernels; parity suites green in CI |
| **G3 — Trusted artifacts** | Reproducible build; pinned toolchain; published hash/SBOM; provenance gate fails on drift |
| **G4 — API + budgets** | Documented migration path + deprecation window elapsed; bundle-size/cold-start budgets met for edge targets |

## 8. Phases

- **P0 — Decouple (landed).** `realtime` no longer imports the wasm-coupled root
  (`@totemsdk/core/adapters`); edge/Workers bundling docs + esbuild alias guidance
  added (`packages/core/README.md`). **Root wasm-free-by-default (Fix A) is still
  pending** (part of P1/P4).
- **P1 — Portable WASM (in progress).** `core-wasm` now builds a `--target web`
  artifact (`pkg-web`) exposing async `init()`; exported as `@totemsdk/core-wasm/web`.
  `@totemsdk/core/wasm-async` exposes the async crypto surface (same names as the
  root, `await init()` once). Proven locally: async init with explicit wasm bytes
  (no fetch/`fs` in glue), byte-parity with the Node target
  (`packages/core-wasm/tests/web-init.test.mjs`), and the core async entry under
  Node ESM (`packages/core/test/wasm-async.test.mjs`). Runtime matrix so far:
  **Node (ESM) and Bun both pass**, including an **isolate** run in a
  `worker_threads` worker (`packages/core-wasm/tests/web-worker.mjs`) — a proxy
  for edge/Worker runtimes (fresh module registry, bytes supplied, no fetch).
  Remaining: browser (Vite) + actual Workers matrix in CI, embedded-bytes entry,
  and making the `@totemsdk/core` root wasm-free by default. *(Gate G1.)*
- **P2 — Parity hardening (in progress).** Kernel **coverage matrix** landed:
  `packages/core/test/kernel-baseline.json` triages all 52 WASM kernels
  (23 covered by existing parity suites, 29 `pending`), enforced by
  `kernel-coverage.test.mjs` (new/removed/renamed kernels and dangling parity
  references fail; regeneration preserves annotations via
  `gen-kernel-baseline.mjs`). Remaining: oracle golden vectors for the pending
  kernels, fuzz/property tests, and CI wiring. *(Gate G2.)*
- **P3 — Provenance.** Reproducible/pinned/signed artifacts; SBOM; drift gate.
  *(Gate G3.)*
- **P4 — Deprecate `/legacy`.** Default crypto = `./wasm` where supported; `legacy`
  frozen + warned; migrate internal consumers; budgets measured. *(Gate G4.)*
- **P5 — Remove.** Delete the JS kernels; `@totemsdk/core` = API + single WASM
  implementation. Major version.

## 9. Compatibility & migration

- All additions are additive through P4. The only breaking changes are the async
  `init()` requirement and the P5 removal of `/legacy` — both in a major release,
  after a deprecation cycle.
- Consumers who only use adapters/types are unaffected (they should already import
  `@totemsdk/core/adapters`).
- Consumers bundling for edge get a working WASM path (G1) instead of an alias
  workaround.

## 10. Security considerations

- **Removes the dual-impl drift class** (RFC-018 P2-3, RFC-020 P2-10 were both
  drift). Single implementation ⇒ a fix cannot land in only one path.
- Rust is memory-safe and less JIT/timing-variable than JS for WOTS/TreeKey.
- **New risk: the WASM artifact becomes the single point of trust.** Mitigated by
  G3 (reproducibility, provenance, SBOM) and G2 (oracle parity). A compromised or
  drifted `.wasm` is catastrophic — the provenance gate is load-bearing, not
  cosmetic.
- Do not use the JS implementation as the parity oracle (circularity); the oracle
  stays external (C++/Java node).

## 11. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Toolchain fragility (`rustc`/`wasm-bindgen` churn) | Pin versions; reproducibility gate (G3) |
| Edge cold-start / size regression | Budgets in G4; embedded-bytes option; measure per runtime |
| Non-WASM runtimes (RN/Hermes, some serverless) | Keep a frozen, documented shim only if a supported target requires it |
| Async migration churn | `init()`-once + sync calls; codemod; deprecation window |
| Parity blind spots | Coverage matrix blocks sunset until zero legacy-only kernels |

## 12. Alternatives considered

- **Keep both implementations indefinitely.** Rejected: permanent drift class +
  doubled surface.
- **Generate the JS from Rust** (e.g., wasm2js). Rejected: poor performance,
  toolchain complexity, no security benefit over a native JS kernel.
- **Runtime JS fallback after sunset.** Rejected as a default; allowed only as a
  frozen shim for a specific unsupported target.
- **Date-based sunset.** Rejected in favour of the G1–G4 trigger; portability, not
  the calendar, decides.

## 13. Open questions

- **Q1** Should `./wasm` expose an async API only, or `init()` + sync (Node) + async
  (edge)? Proposed: `init()` + sync, plus async wrappers where needed.
- **Q2** Is a Node-only synchronous variant (`./wasm/sync`) worth the surface, given
  Node can `await` at top level in ESM and via IIFE in CJS?
- **Q3** Which non-WASM targets (if any) must keep a shim, and for how long?
- **Q4** Where does `verify.ts` (server-side auth) live post-sunset — `./wasm` or a
  higher-level `./auth` that composes WASM kernels?
- **Q5** Budget thresholds for G4 (wasm bytes, cold-start ms) per runtime.
