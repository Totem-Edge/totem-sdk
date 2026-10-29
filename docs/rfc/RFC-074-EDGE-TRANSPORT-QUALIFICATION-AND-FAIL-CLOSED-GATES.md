# RFC-074 — Edge Transport Qualification and Fail-Closed Release Gates

**Status:** Draft — implementation in progress on `rfc-074/edge-gates`, concurrently with non-edge publications. No edge-family v1 promotion is authorised until Phase 0 and Phase 1 exit criteria pass.
**Priority:** P0
**Created:** 2026-10-29
**Authors:** Totem SDK Contributors
**Depends on:** RFC-022 (Prepared Command Binding), RFC-023 (Agent Policy / physical limits), RFC-031 (runtime portability), RFC-063 (production readiness and maturity)
**Touches:** `scripts/verify-workspace.mjs`, `scripts/verify-consumer-pack.mjs`, `scripts/smoke-release-install.mjs`, CI workflows, `packages/edge`, all `edge-*` packages, native sidecars and their distribution

> **Decision.** Make the release gates prove real operation before promoting any
> edge profile. Repair the verifier so empty, skipped or unexercised checks fail
> closed. Then qualify `edge-mqtt` and `edge-modbus` as the first defensible v1
> profiles, and leave the remaining connectors RC/Alpha until each has a tested
> binding, recovery evidence and a support owner.
>
> The ongoing 61-package publication train is a packaging/version release. It is
> **not** evidence of edge production readiness and does not satisfy this RFC.

---

## 1. Summary

This RFC separates three things that are currently conflated:

1. **API maturity** — a package’s version/semver stability.
2. **Support tier** — whether the project supports a package in production.
3. **Qualified profile** — a specific runtime, binding, security mode and
   recovery contract that has been exercised against a real implementation.

The SDK currently has 14 `edge-*` packages: thirteen RC and one Alpha (`edge-nfc`).
The base `edge` package is labelled v1 but remains a Tier 2 support dependency.
Only `edge-mqtt` and `edge-modbus` are Tier 1 production candidates. That is the
correct scope for the first promotion.

The release verifier can currently report PASS without executing the evidence it
claims. This RFC makes that impossible.

## 2. Current findings

### 2.1 False-green gates

- `verify-workspace.mjs --maturity v1` with no selected packages reports
  “0 passed, 0 failed — PASS”.
- Missing `test:integration` scripts are silently skipped; no edge-family package
  declares one.
- RC and v1 have identical configured requirements.
- No edge package declares a `lint` script, and the verifier skips linting.
- The consumer check extracts packages with Totem dependencies without importing
  or exercising them.
- The release smoke check can succeed when dependencies are unavailable.
- Branch protection and rulesets are reported disabled, so a failing workspace
  check does not block merge.

### 2.2 Concrete defects

- **MQTT replay/time:** concurrent duplicates can both execute because the
  command ledger uses separate read/write operations. Future-dated commands are
  accepted, and replay protection expires with ledger retention.
- **MQTT signing:** `proof-package` can fall back to WOTS index `0` when no lease
  provider is supplied.
- **Modbus:** Go and TypeScript response shapes disagree; coil/register parsing
  can produce false readings; empty writes and wrong unit/function responses are
  accepted; the Go request unit ID is not carried into the client handler.
- **NFC:** valid records with IDs and larger payloads throw `RangeError`, and the
  decoder zero-pads truncated payloads.
- **Prepared commands:** approval does not yet bind the exact device, endpoint,
  command, parameters and derived physical effects; ambiguous timeouts can be
  retried instead of becoming `unknown/reconcile`.

## 3. Goals

1. Make every required gate fail closed on missing, skipped or unexercised
   evidence.
2. Qualify one real MQTT profile and one real Modbus profile end to end.
3. Make physical-action approval bind the exact prepared command and effects.
4. Define native sidecar distribution, versioning, health and upgrade contracts.
5. Establish a reusable promotion process for the remaining connectors.
6. Keep API maturity, support tier and qualified profile independently recorded.

## 4. Non-goals

- Promoting all 14 `edge-*` packages to v1.
- Replacing existing port-injected architecture.
- Implementing a generic “works everywhere” protocol claim.
- Treating successful Go compilation as protocol conformance.
- Changing payment or custody authority as part of this work.
- Requiring live PLC/broker hardware in default CI; deterministic simulators and
  recorded evidence are acceptable, with named limitations.

## 5. Phase 0 — Fail-closed gates

### 5.1 Verifier semantics

- An explicit maturity selector must activate that maturity’s gates. Selecting
  no packages is an error, not a PASS.
- Missing required scripts fail unless the package declares a machine-readable
  `notApplicable` record with an owner and reason.
- RC and v1 require different evidence sets.
- Every package must run lint, or inherit one shared mandatory configuration.
- The verifier must report selected, skipped and not-applicable counts separately
  and fail on an empty selected set.

### 5.2 v1 evidence

At minimum, v1 adds:

- `test:integration`;
- packed-consumer ESM, CJS and type imports that call public APIs;
- protocol/runtime conformance for the declared binding;
- recovery/restart evidence;
- release evidence tied to the tagged commit;
- an owner and runnable quickstart.

### 5.3 Consumer and release checks

- Install the complete packed dependency closure.
- Import and exercise ESM and CJS entry points.
- Typecheck a consumer that uses the declared public surface.
- Fail release publication when installation or the smoke call cannot be verified.

### 5.4 Repository enforcement

- Require the workspace gate, release smoke and Go native jobs as protected
  status checks.
- A failing upstream job must prevent the workspace tests from being reported as
  a green baseline.

## 6. Phase 1 — MQTT and Modbus qualification

### 6.1 `edge-mqtt`

Required changes:

- atomic command claim keyed by issuer/device/command with a unique constraint;
- durable execution status and restart reconciliation;
- bounded timestamp window; reject future-issued commands;
- replay tombstones retained independently of command-ledger expiry;
- signing requires a durable lease/signing port; no WOTS index-0 fallback;
- explicit production vs fixture signing modes.

Required evidence:

- Mosquitto or EMQX reconnect/persistent-session tests;
- QoS 0/1/2 duplicate and redelivery tests;
- ACL/TLS failure tests;
- credit-limit and offline-queue tests;
- packed ESM/CJS consumer using the real WASM artifacts.

### 6.2 `edge-modbus`

Required changes:

- one canonical Go/TS wire contract for request and response;
- unit ID routing into the native request;
- function/unit/length validation on every response;
- explicit write acknowledgements;
- signedness/endianness and register-map conformance;
- correlation and timeout handling for concurrent requests.

Required evidence:

- Modbus simulator CI for FC1–4/5/6/15/16;
- malformed-frame and wrong-unit tests;
- concurrent request/reconnect tests;
- at least one recorded PLC or simulator capture with read and governed write.

### 6.3 `edge-nfc`

Fix NDEF header sizing, length validation and truncation rejection before any
Alpha promotion. Add a platform capability matrix and reader/mobile binding
evidence.

## 7. Phase 2 — Common runtime and actuation guarantees

- Complete RFC-022 prepared-command binding: approval covers device, endpoint,
  command, parameters and derived physical effects.
- Apply RFC-023 physical limits to the exact prepared command.
- A timeout after a write is `unknown/reconcile`; never auto-retry a physical
  action.
- Test concurrent start/stop, partial startup failure, overlapping polls,
  cancellation, listener cleanup, queue limits and slow consumers.
- Surface proof failures; no swallowed bridge errors.
- Declare durability ownership per connector: MQTT owns an offline queue; other
  connectors delegate persistence to the caller.

## 8. Phase 3 — Remaining connectors

Each connector needs a declared supported profile before promotion:

| Package | Required profile work |
|---|---|
| `edge-adapters` | Real SQLite commerce persistence, two-process negotiation, outbox recovery, artifact recovery |
| `edge-coap` | URI-option encoding, token/endpoint correlation, retransmission, separate responses, security/blockwise profile |
| `edge-grpc` | Raw-byte codec, TLS/auth, stream ownership, cancellation, deadlines, backpressure |
| `edge-opcua` | Rust sidecar build/tests, non-anonymous security mode, certificates, subscriptions, numeric conversions |
| `edge-can` | SocketCAN/vcan interoperability, ID/DLC validation, filtering, bus-error recovery; classic CAN vs CAN FD |
| `edge-bacnet` | Real binding, discovery limits, COV renewal, write priorities, reconnect |
| `edge-ble` | Platform bindings, permissions, pairing, GATT failures, notification cleanup |
| `edge-ros2` | Real ROS2/DDS containers, QoS profile, service timeout/cancellation, serialization parity |
| `edge-matter` | Matter-stack binding, commissioning, fabric persistence, ACL, removal, subscription restore |
| `edge-lorawan` | Radio vs network-server target, key/frame-counter ownership, join/rejoin, dedup, confirmed messages |
| `edge-email` | SMTP/IMAP bindings, TLS/auth failures, UIDVALIDITY changes, MIME/attachment limits, duplicate delivery |
| `edge-nfc` | NDEF repair, malformed-input tests, APDU status/chaining, platform matrix |

Promotion order is by deployment demand and evidence availability, not by
package count.

## 9. Native sidecar distribution

The five native packages currently have no clear npm distribution of binaries or
sources. Before promotion, choose one contract:

1. bundled prebuilt binary with platform matrix; or
2. separately versioned sidecar with install, health, compatibility and upgrade
   contract; or
3. explicitly unsupported on that platform.

Every native package must have at least one Go or Rust test that exercises the
TS↔native protocol contract. Compilation alone is not evidence.

## 10. Exit criteria

### Phase 0

- Empty maturity selection fails.
- Missing required scripts fail unless explicitly not applicable.
- RC/v1 requirements differ.
- Lint runs for every package.
- Packed consumer imports and calls ESM/CJS.
- Release smoke fails when installation is unverifiable.
- Required checks block merge.

### Phase 1

- MQTT replay/concurrency/time tests pass, including restart reconciliation.
- MQTT signing cannot use index 0 in production mode.
- Modbus Go/TS contract tests pass; malformed/wrong-unit/empty-write responses fail.
- MQTT and Modbus have named real-binding evidence and recovery runbooks.

### Phase 2

- Prepared command approval binds exact effects.
- Unknown-outcome reconciliation is tested.
- Lifecycle, cancellation and resource cleanup tests pass.

### Phase 3

- Each promoted connector has a profile, owner, compatibility matrix, quickstart
  and release evidence.

## 11. Release and promotion rules

- A package version release does not promote its support tier.
- `edge` API maturity and `edge-*` support tier are recorded separately.
- Current publication-train artifacts are packaging releases only.
- v1 promotion requires a signed-off evidence package tied to the exact tag.
- If a gate cannot run, the promotion is blocked, not “conditionally passed”.

## 12. Open questions

1. Which MQTT broker matrix is in scope for the first profile (Mosquitto only,
   Mosquitto+EMQX, or a minimum feature profile)?
2. Which Modbus stack is the reference implementation for v1: the Go sidecar,
   an external gateway, or both?
3. Which native distribution model is preferred for mobile/Bare?
4. Do `edge-mqtt` and `edge-modbus` remain separate support tiers or share one
   “governed device I/O” tier?
5. What is the rollback policy for a promoted connector if a later release loses
   its binding evidence?

## 13. Sequencing alongside the publication train

1. Land Phase 0 gate repairs and obtain a green protected baseline.
2. Fix MQTT and Modbus defects.
3. Run real/simulator qualification and record evidence.
4. Promote only the two qualified profiles.
5. Continue Phase 2 common guarantees.
6. Promote remaining connectors only as deployment demand and evidence justify.

The publication train may finish independently. It must not be used to declare
any edge profile production-ready.

## 14. Implementation progress (2026-10-29)

Work is isolated on `rfc-074/edge-gates`. The local publication controller runs
with `--exclude-edge`, deferring `edge` and every `edge-*` package while allowing
unrelated immutable-tag publications to continue. Existing release tags do not
contain these fixes; follow-up versions are required after qualification.

### Implemented and exercised

- Workspace maturity selectors are validated and select the exact package
  maturity. A selector alone executes its configured requirements. Selected
  prerequisite builds include the dependency closure, not unrelated packages.
  Missing enabled requirements fail. N/A records require `owner` and `reason`,
  are reported separately, and cannot produce an all-skipped PASS. Hygiene and
  prerequisite-only work cannot stand in for executed gate commands.
- Consumer checks install sibling dependencies and evaluate advertised ESM/CJS
  root exports, including nested CommonJS `.js` entries. Missing dependencies,
  broken entries and zero selected probes fail. Release smoke no longer exits
  successfully when sibling registry resolution fails. Four real tarball/npm
  consumer regressions, ten executable workspace-verifier regressions and two
  controlled registry/install-failure release-smoke regressions pass. CI includes
  these regressions plus the Modbus integration and Go race checks.
- MQTT command claims use an atomic durable store contract; get/set-only stores
  are rejected. Handler-local claims are atomic across concurrent deliveries.
  Safe-integer timestamps, future/age/lifetime limits and expiry after async
  verification/policy are checked. Uncertain claim persistence blocks execution;
  claims remain consumed after executor errors. Signing with a seed requires a
  lease provider. All 163 package tests and ESM/CJS compilation pass.
- Modbus uses one unit-prefixed, CRC/MBAP-free PDU contract. Requests, response
  identity/length/count and actual write echoes are validated. Sensor proofs use
  the same validated gateway. Go serializes exchanges and applies each request's
  unit ID. Uncertain writes are not retried. All 48 TypeScript tests, Go race
  tests/vet and an ESM/CJS-to-Go JSON-line/TCP simulator integration pass.
- NFC allocates the complete SR/long-payload/ID header and bounds-checks complete
  messages before payload allocation. Truncated, invalid-boundary and unsupported
  chunked records throw instead of producing partial/zero-padded records. All 43
  package tests and ESM/CJS compilation pass.

### Remaining exit criteria

Phase 0 and Phase 1 are **not closed**. The real v1 lint invocation now fails
because all 18 selected packages lack lint scripts. Shared lint, distinct v1
requirements, dependency-closure/type/subpath consumer coverage and protected
merge checks still need implementation/evidence. Consumer regressions use local
file dependencies; they do not establish registry-wide closure compatibility.

MQTT tests simulate an atomic shared store and lease provider. A real durable
store's multi-process/crash recovery, broker binding and clock/replay recovery
profile remain unqualified. Modbus evidence covers loopback TCP, not serial
hardware/RTU recovery or native binary distribution. Full prepared-command
binding and unknown physical-effect reconciliation remain Phase 2 work.
