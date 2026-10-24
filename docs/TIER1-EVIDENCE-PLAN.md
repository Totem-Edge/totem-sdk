# Tier 1 Production Evidence Plan

**Status:** Active evidence plan — Tier 1 candidates are not production

**Parent:** [RFC-063 §4](rfc/RFC-063-PRODUCTION-READINESS-AND-MATURITY-PROMOTION.md#4-production-surface)

**Reference commit:** `c3b007c0`

Tier 1 is the production-candidate set. These packages may be published and used,
but they must not carry a production label until the evidence below is complete
and the package is promoted to Tier 0. Their explicit channel tag is `next`,
`beta` or `alpha`; `latest` may remain npm's required default when no stable v1
exists.

The current support tiers are generated in [maturity.md](maturity.md).

---

## 1. Common Tier 1 exit gates

Every Tier 1 package must satisfy the applicable RFC-063 §3.2 gates before
promotion:

- **P0 truth:** version, manifest, README, generated matrix and npm dist-tag agree.
- **P2 tests:** unit, integration, failure semantics, restart and conformance
  evidence for the claimed surface.
- **P5 release:** Apache-2.0 `LICENSE`, `NOTICE`, provenance-attested package,
  working exports and SBOM where applicable.
- **P6 operations:** durable state, recovery and upgrade/rollback where the package
  owns state.
- **P7 ownership:** named owner, support channel and response expectation.

A Tier 1 package also needs **dependency closure**: every required runtime
dependency must be Tier 0, Tier 1 or Tier 2, and any gated Alpha dependency must
be documented. A Tier 1 package may use an Alpha dependency only while it makes no
production claim.

---

## 2. Package evidence

### wots-lease

**Current:** `rc`, Tier 1. API is v1-stable but the package is blocked from Tier 0
by its dependency support surface.

**Evidence today**

- `watermark`, `journal`, `seed`, `reservation-recovery`, `one-time-key-reuse`,
  `quorum`, `hybrid`, `on-chain`, `personal-lease-node` tests.
- Explicit fail-closed seed/watermark recovery tests.
- On-chain lease path exists.

**Missing**

- `storage` is Alpha; `txpow` must meet the Tier 2 bar.
- Real-node restart/recovery evidence for the durable lease path.
- Channel tag `next` is present; `latest` remains npm's required default until a stable v1 exists.

**Exit**

- Storage and txpow dependencies meet the Tier 2 bar.
- Crash/restart and restored-backup tests show no signing-leaf reuse.
- Real-node lease/watermark recovery passes.
- Dist-tag and docs agree with `rc`.

### omnia

**Current:** `rc`, Tier 1. Strongest Omnia candidate; not yet dependency-closed.

**Evidence today**

- TypeScript/Rust/WASM parity fixtures and channel-state tests.
- Channel, HTLC, vault, meter and program tests.
- Relay operations, coordination and custody tests.
- AWS 8-node, 7-hop routing and non-custodial HTLC evidence.
- Timeout, reconnect and concurrent HTLC tests.

**Missing**

- Required support dependencies include `agent-policy`, `chain-provider`,
  `stream-transport`, `tx-builder`, `txpow` and `wots-lease`.
- P7 owner/support expectation.
- Channel tag `next` is present; `latest` remains npm's required default until a stable v1 exists.

**Exit**

- Dependency closure on the supported payment/channel path.
- Repeated real-node 7-hop and factory/VC runs from a clean environment.
- Crash/restart evidence for the claimed state transitions.
- Dist-tag and docs agree with `rc`.

### omnia-host

**Current:** `rc`, Tier 1. Blocked by durable host state.

**Evidence today**

- `e2e`, `prepare-submit-pay`, `prepare-submit-settle`,
  `prepare-submit-factory`, `prepare-submit-splice`, `vtxo`, `identity`,
  `route-party-id`, `observe`, `mutations` tests.
- AWS non-custodial open → pay → settle and 7-hop routing evidence.
- Timeout, reconnect and concurrent HTLC probes.

**Missing**

- **Known blocker:** 2026-10-22 7-hop teardown failed because the factory registry
  was lost on restart (`Factory ... not found`).
- Durable factory/VC/splice/pool/VTXO state and recovery.
- `storage` is Alpha.
- Channel tag `next` is present; `latest` remains npm's required default until a stable v1 exists.

**Exit**

- Factory registry survives restart; teardown and reopen pass.
- Crash/restart during factory, VC, splice, HTLC and pool operations.
- Durable store wiring is proven, not only available as a helper.
- Dist-tag and docs agree with `rc`.

### storage

**Current:** `rc`, Tier 1. The durable SQLite adapter and host adoption have
landed; production evidence is still being gathered.

**Evidence today**

- Conformance tests for SQLite, file, IndexedDB and memory adapters.
- Journal, namespace, artifact, snapshot, persistence, codec and relational tests.
- Synchronous SQLite adapter with legacy-table migration.
- `omnia-host` 0.12.0 persists channel/operation/observation state through the
  storage contract.
- FileStore AUD-033 lost-update race fixed; repeated in-process and cross-process
  CAS conformance runs pass.
- Runtime-neutral contract with no Hypercore/network dependency.

**Missing**

- Crash/power-loss and corruption recovery evidence across backends.
- Backend parity under sustained contention and reopen.
- Adoption by `wots-lease`, `industrial-action` and `edge-mqtt` without
  helper-only wiring.
- Channel tag `next` is required for rc; `latest` remains npm's required default
  until a stable v1 exists.

**Exit**

- All conformance suites pass on the supported runtimes.
- Crash/power-loss and corrupt-state tests fail closed.
- Host and lease paths use the durable contract end to end.
- Dist-tag and docs agree with `rc`.

### lookup-protocol

**Current:** `rc`, Tier 1.

**Evidence today**

- Framing, version negotiation and WOTS auth tests.
- Session-ticket digest parity with Go.
- Manifest/retrieval endpoint definitions exist.

**Missing**

- Multi-peer conformance across TypeScript and Go.
- Fuzz/property tests for framing and malformed payloads.
- Channel tag `next` is present; `latest` remains npm's required default until a stable v1 exists.

**Exit**

- Go/TS interop and malformed-input tests pass.
- Version and capability negotiation are pinned.
- Dist-tag and docs agree with `rc`.

### lookup-client

**Current:** `rc`, Tier 1.

**Evidence today**

- WOTS auth, session-ticket, chain-query and identity-wallet tests.
- Go auth-envelope interop vector.
- WebSocket and Hyperswarm transports exist.

**Missing**

- Durable session/ticket and reconnect recovery.
- Two-process multi-peer and teardown tests.
- Shared connection-manager cleanup (RFC-057 D10).
- Channel tag `next` is present; `latest` remains npm's required default until a stable v1 exists.

**Exit**

- Reconnect/restart tests preserve the correct ticket/session state.
- No listener/swarm leak on timeout or failure.
- Dist-tag and docs agree with `rc`.

### lookup-node

**Current:** `rc`, Tier 1.

**Evidence today**

- Watchlist, handlers, auth, trust, relay, registry-WOTS, lease and session-ticket
  tests.
- Go interop and tree-key vectors.
- Ticket store and revocation path exist.

**Missing**

- Durable ticket store and identity across restart.
- Multi-peer, teardown and reconnect evidence.
- Channel tag `next` is present; `latest` remains npm's required default until a stable v1 exists.

**Exit**

- Ticket/identity state survives restart.
- Multi-peer lookup and revocation pass on real transports.
- Dist-tag and docs agree with `rc`.

### industrial-action

**Current:** `rc`, Tier 1.

**Evidence today**

- Error taxonomy, versioning/events, adversarial durability, scheduling/approvals,
  units/resources, profiles, recipes, interlocks/locks, standards and edge-adapter
  tests.
- Two-phase/idempotent execution and authority binding exist.

**Missing**

- HIL evidence for physical effects.
- Conformance for the supported industrial profiles.
- Dependency closure on `proof`, `authority`, `edge`, `agent-policy`, `storage`.
- Channel tag `next` is present; `latest` remains npm's required default until a stable v1 exists.

**Exit**

- HIL and failure-semantics tests pass.
- Authority and physical-effect policies are enforced end to end.
- Dist-tag and docs agree with `rc`.

### edge-mqtt

**Current:** `rc`, Tier 1.

**Evidence today**

- Rules, manifest, lookup, realtime, canonical, exports, receipts, sensor bridge,
  queue, replay-ledger, gateway and client-port tests.
- Durable queue crash/reopen and unacked redelivery tests.

**Missing**

- Broker HIL and reconnect evidence.
- Credit-gate and offline-queue behavior against a real broker.
- `storage` is Alpha.
- Channel tag `next` is present; `latest` remains npm's required default until a stable v1 exists.

**Exit**

- Real-broker reconnect, duplicate, replay and power-loss tests pass.
- Credit and queue limits are enforced.
- Dist-tag and docs agree with `rc`.

### edge-modbus

**Current:** `rc`, Tier 1.

**Evidence today**

- Gateway start/stop, FC1–FC4 read paths, RTU framing and register parsing tests.

**Missing**

- HIL PLC evidence.
- Reconnect, error taxonomy and register-map conformance.
- Channel tag `next` is present; `latest` remains npm's required default until a stable v1 exists.

**Exit**

- HIL read/write and reconnect tests pass.
- Register mapping and failure semantics are documented and tested.
- Dist-tag and docs agree with `rc`.

---

## 3. Dist-tag targets

| Tier | Level | Channel tag | `latest` |
|---|---|---|---|
| Tier 0 | v1 | `latest` | Required; points at v1 |
| Tier 1 | rc | `next` | May remain as npm's required default if no stable v1 exists; not a production claim |
| Tier 1 | beta | `beta` | Same |
| Tier 1 | alpha | `alpha` | Same |
| Tier 2 | v1/rc | current maturity tag | v1 may use `latest`; rc uses `next` |
| Outside | v1 | `latest` | Allowed for its own stable scope |
| Outside | rc/beta/alpha | `next` / `beta` / `alpha` | May remain as npm's required default; not a production claim |

npm does not allow removing `latest`. Tier 1 packages therefore use an explicit
channel tag; `latest` may still point at the newest prerelease when no stable v1
exists. Run `node scripts/report-dist-tags.mjs` for the drift report;
`--commands` prints missing channel-tag additions, and `--check` is suitable for
a release gate. See [DIST-TAG-MIGRATION.md](DIST-TAG-MIGRATION.md).

---

## 4. Promotion checklist

Before moving any package from Tier 1 to Tier 0:

- [ ] P0–P7 evidence linked from this document.
- [ ] Dependency closure proven.
- [ ] Real-node or HIL evidence recorded in `docs/OMNIA_TEST_RESULTS.md` or the
      relevant package test record.
- [ ] `docs/maturity.md`, README, `SDK_MANIFEST.json` and npm dist-tag updated.
- [ ] Release notes state the promotion and remaining limitations.
