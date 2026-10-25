# RFC-063 — Production Readiness and Maturity Promotion

**Status:** Draft — Phase 0 closeout (tier reconciliation and E1–E4 remain); Phase 1 B1 published, B2–B9 open; Phases 2–4 proposed
**Priority:** P0 (public truth) / P1 (security and durability) / P2 (real-world proof)
**Created:** 2026-10-21
**Authors:** Totem SDK Contributors
**Depends on:** RFC-007 (storage durability), RFC-019 (agent commerce residual), RFC-021/022/023 (decision binding, command lifecycle, physical effects), RFC-031 (core-wasm P5), RFC-032/032-A (lookup identity and tickets), RFC-033 (Go WOTS parity), RFC-057 (replication Phase 0), RFC-058/061 (custody boundaries), RFC-062 (pairing)
**Touches:** `README.md`, `SECURITY.md`, `SDK_MANIFEST.json`, `scripts/workspace-gates.config.json`, `.github/workflows/`, `docs/`, package metadata, release notes. **No new public package is authorised by this RFC.**

> **Positioning.** The SDK does not need more surface area to look production-ready.
> It needs fewer unsupported claims, a smaller production core, and evidence for
> the claims it keeps. This RFC defines what **Production** means, which packages
> are allowed to use it, and the gates a package must pass before it does.
>
> It deliberately does **not** declare all 67 publishable packages production.
> Breadth is not maturity. A narrow, audited, reproducible core with explicitly
> explicitly labelled support tiers is more credible than a large catalogue of
> alpha-to-RC packages.

---

## 1. Summary of decisions

1. **Production is earned per package, not per repository.** A package may carry
   the README label **Production** only after passing the gates in §3.
2. **The production core is deliberately small and dependency-closed.** Tier 0
   currently contains the cryptographic and VM foundation. Omnia, host, storage,
   lookup, industrial action and selected edge connectors are Tier 1 candidates.
   Every package a Tier 0/1 package imports at runtime must be Tier 0, Tier 1 or
   a support dependency in Tier 2. Everything outside the production surface
   keeps its evidence-based level; it is not automatically labelled Preview.
3. **Maturity labels must agree across five places:** `README.md`,
   `scripts/workspace-gates.config.json`, `SDK_MANIFEST.json`, npm dist-tags, and
   the generated API docs. Drift is a release-blocking defect.
4. **Public facts must be generated or gated.** Package counts, domain counts,
   RFC statuses, supported versions, and release claims must not be hand-edited
   into staleness. Phase 0 adds a verification gate for the highest-value claims.
5. **Every production claim needs evidence.** Security review, conformance tests,
   crash/restart tests, a quickstart, an owner, and a support expectation are the
   minimum evidence set.
6. **Release engineering is part of the product.** A release must be reproducible,
   provenance-attested, documented, and tagged with an unambiguous maturity
   dist-tag.
7. **The repository remains pre-1.0 until the production core passes Phase 2.**
   Pre-1.0 permits breaking changes; it does **not** permit ambiguous support
   claims or unsupported compatibility shims.
8. **RFC status is part of the public API.** An incomplete RFC must say
   **Landed**, **In progress — remaining: …**, **Authorised — not started**, or
   **Proposed — design only**. “Authorised” never implies delivery.
9. **Phase 0 starts immediately.** It is documentation, truth, metadata, and
   release hygiene only. No new protocol or package work is required.
10. **RFC-057 stays Phase 0.** Hypercore/Autobase replication is not a
    production-readiness task and must not be used to delay Phases 0–2.

---

## 2. Current state (verified 2026-10-21)

The repository is stronger than several public claims suggest:

- **67 publishable packages across 9 domains** in `SDK_MANIFEST.json`.
- **100 GitHub releases** and an automated `publish-totemsdk.yml` workflow with
  npm provenance and docs deployment.
- **RFC-032/032-A are landed** for the TypeScript lookup stack and the Go
  lookup-client/lookup-node ticket paths. Ed25519 is removed from that stack.
- **RFC-018 and RFC-020 are landed**; RFC-019 has one residual.
- The `se-server` volatile-storage default was fixed; RFC-007 Phase 5 and some
  Phase 4 conformance remain.
- **RFC-031 P1–P4 are substantially landed**; P5 is the remaining legacy
  retirement.

The polish gap is therefore concentrated in public truth and proof:

| Gap | Evidence | Phase |
|---|---|---|
| README says 60 packages / 6 domains | `README.md:249` | 0 |
| README RFC table stops at RFC-033 (with stale 018/019/020 statuses) | `README.md:507-535` | 0 |
| `docs/README.md` RFC table omits RFC-037 onward | `docs/README.md:145+` | 0 |
| Maturity table covers 7 rows for 67 packages | `README.md:253-266` | 0 |
| `SECURITY.md` claims 2.x supported while many packages are 0.x | `SECURITY.md` supported versions | 0 |
| PGP block is a placeholder | `SECURITY.md` | 0 |
| Generated TypeDoc needs regeneration | RFC-032 audit residual | 0 |
| RFC-019 residual and RFC-021/022/023 draft | RFC statuses | 1 |
| RFC-007 Phase 5 / Phase 4 conformance | RFC-007 | 1 |
| RFC-031 P5 legacy retirement | RFC-031 | 1 |
| No public independent audit of the current code | archived Feb 2026 audit only | 2 |
| Most edge connectors are reference-only | README maturity table | 2 |

---

## 3. Maturity levels and production gates

### 3.1 Level definitions

| Level | Meaning | Allowed public use |
|---|---|---|
| **Production** | Supported for real value, with evidence and an owner | `latest` npm tag; README production table; docs marked stable |
| **RC** | Feature-complete, API-frozen for the next minor, awaiting production evidence | `next` tag; “release candidate” label. `latest` may remain as npm's required default when no stable v1 exists; it is not a production claim. |
| **Beta** | Usable, but API may change; integration testing expected | `beta` tag; beta label |
| **Alpha** | Architecture proof; no compatibility promise | `alpha` tag |
| **Preview** | Demonstrator or experimental; may be removed | `preview` tag or not published |
| **Excluded** | Private/test harness; never published | no npm package |

Maturity is a property of the **published package**, not of the repository’s
ambition. A package can be technically impressive and still be Alpha.

### 3.2 Production gates

A package may be labelled Production only when all gates pass:

| Gate | Requirement | Evidence |
|---|---|---|
| **P0 — Truth** | Public counts, statuses, versions, and RFC links are current | Generated or CI-checked |
| **P1 — Security** | Threat model covers the package; no open P0/P1 finding; fuzz/property tests for parsers and state transitions | Review record, CI targets |
| **P2 — Tests** | Unit, integration, conformance, crash/restart, and failure-semantics tests; cross-language parity where claimed | CI matrix |
| **P3 — API** | Stable API, typed errors, strict schemas, documented limits, no deprecated/legacy default path | API docs, compatibility policy |
| **P4 — Docs** | Current API reference, five-minute quickstart, runnable example, troubleshooting | Docs build |
| **P5 — Release** | Provenance-attested package, SBOM, license, README, working ESM/CJS exports, reproducible build | Publish workflow |
| **P6 — Operations** | Durable state/recovery, monitoring hooks, deployment guide, upgrade/rollback path | Runbook, tests |
| **P7 — Ownership** | Named owner, support channel, response expectation, security contact | `CODEOWNERS`, `SUPPORT.md` |

A package that fails any gate must move down a level; it must not keep the label
while the gap is “tracked.” Labels describe the present, not the roadmap.

---

## 4. Production surface

The production surface is the set of packages the SDK is willing to support. It
is deliberately narrow and **dependency-closed**: a package cannot be Tier 0
while a required runtime dependency is Alpha, Preview or unowned.

### 4.1 Tiers

| Tier | Meaning | Public use |
|---|---|---|
| **Tier 0 — Production core** | First-line supported packages that pass §3.2 and whose runtime dependencies are Tier 0, 1 or 2 | `latest`; README production table; stable docs |
| **Tier 1 — Production candidates** | Explicitly targeted for Tier 0 but still gathering evidence; may be RC or Alpha | `next`, `beta` or `alpha`; `latest` may remain only as npm's required default when no stable v1 exists, never as a production claim |
| **Tier 2 — Required support dependencies** | Packages imported by Tier 0/1 on the supported path; they need a minimum stability bar, not headline production docs | RC or higher; no Alpha/Preview on a required path |
| **Outside the production surface** | Not part of the first-line support promise; keeps its evidence-based maturity | Whatever the current level is: v1, RC, Beta, Alpha, Preview or Excluded |

“Outside the production surface” does **not** mean Preview. A package can have a
stable v1 API and still be outside the first-line production core.

### 4.2 Tier 0 — current production core

Current Tier 0:

- `core`
- `core-wasm`
- `kissvm`

These are the only packages with a complete production claim today. They are
the cryptographic and VM foundation, have no required Alpha/Preview runtime
dependency, and are the least ambiguous support surface.

`wots-lease` is the next Tier 0 candidate. It has a v1 API, but its `storage` and
`txpow` dependencies must first meet the Tier 2 minimum bar. Until then it stays
in Tier 1 even though its package version and API are stable.

### 4.3 Tier 1 — production candidates

- `wots-lease` — v1 API; blocked on the `storage`/`txpow` dependency review.
- `omnia` — strongest Omnia candidate; AWS 8-node and non-custodial HTLC evidence
  exists, but its dependency closure and ownership gate are incomplete.
- `omnia-host` — rc; durable host state and factory-registry recovery must pass
  before any production claim.
- `storage` — alpha; promotion is a prerequisite for `wots-lease`,
  `omnia-host`, `industrial-action` and `edge-mqtt`.
- `lookup-protocol`, `lookup-client`, `lookup-node` — rc; TypeScript/Go ticket
  parity is landed, but durable multi-peer and restart evidence remains.
- `industrial-action` — rc; needs HIL and conformance evidence.
- `edge-mqtt`, `edge-modbus` — rc; need HIL and conformance evidence.

Tier 1 packages may be published and used, but they must not carry a production
label. npm requires a `latest` tag, so an RC/Alpha package with no stable v1 may
still appear there as the registry's required default; that is not a production
claim, and the explicit channel is `next`, `beta` or `alpha`. The per-package
evidence plan is maintained in [TIER1-EVIDENCE-PLAN.md](../TIER1-EVIDENCE-PLAN.md).

### 4.4 Tier 2 — required support dependencies

The current Tier 0/1 import closure requires these packages to meet a minimum
support bar:

- Transaction and chain: `txpow`, `tx-builder`, `chain-provider`, `minima-rpc`
- Identity and evidence: `identity`, `manifest`, `root-identity`, `agent-policy`,
  `authority`, `proof`
- Transport and host coordination: `stream-transport`, `p2p-hub`,
  `pubsub-transport`
- Omnia composition: `omnia-factory`, `omnia-router`, `omnia-pool`,
  `omnia-splice`, `omnia-vtxo`, `liquidity-bond`
- Edge runtime: `edge`

Tier 2 minimum bar for a **Tier 0 dependency**:

- P0 truth (current counts, status, version and RFC links);
- P2 unit/integration tests for the imported surface;
- P5 provenance-attested release with `LICENSE` and `NOTICE`;
- P7 named owner and support expectation;
- no open P0/P1 security finding on the imported path.

Tier 2 packages do not need full Tier 0 documentation or operations evidence.
A Tier 1 candidate may use an Alpha dependency only when the dependency is
explicitly gated and the candidate makes no production claim. A Tier 0 package
may not use an Alpha/Preview runtime dependency on its supported path.

### 4.5 Outside the production surface

Examples include `connect`, `wallet-adapter`, `governance`, `recursive-mast`,
`decision`, `intelligence`, `qvac`, `entity`, `eefi`, the remaining edge
connectors, replication packages and new economic primitives.

These packages retain their measured level. They are not automatically demoted
to Preview, and they are not part of the first-line production promise until
they enter Tier 1 with a named evidence plan.

### 4.6 Promotion and demotion rules

1. A package enters Tier 0 only after passing all §3.2 gates, completing
   dependency closure, naming an owner/support channel, and matching its npm
   dist-tag and generated docs.
2. A Tier 0/1 package whose required dependency becomes Alpha or Preview loses
   its production claim until the dependency is repaired or removed from the
   supported path.
3. A package may be v1 outside Tier 0. That means its API is stable; it is not a
   first-line production support promise.
4. A new package enters Tier 1 only with a named workload, owner, evidence plan
   and exit criterion. Directory presence is not a promotion.
5. Removing a package from Tier 0 changes the support claim, not its version or
   its existing published artefacts.

### 4.7 Current evidence and blockers

| Package | Current position | Blocker / next evidence |
|---|---|---|
| `core`, `core-wasm`, `kissvm` | Tier 0 | Maintain gates; no new production claim from this RFC |
| `wots-lease` | Tier 1 (v1 API) | `storage` is alpha; `txpow` must meet Tier 2 bar |
| `omnia` | Tier 1 | AWS 8-node/7-hop evidence is strong; dependency closure and P7 ownership remain |
| `omnia-host` | Tier 1 (rc) | 2026-10-22 7-hop teardown blocked: factory registry lost on restart; durable host storage required |
| `storage` | Tier 1 (alpha) | Must be promoted before `wots-lease`, `omnia-host`, `industrial-action` or `edge-mqtt` can claim Tier 0 |
| `lookup-*` | Tier 1 (rc) | Real multi-peer durability, restart and teardown evidence |
| `industrial-action` | Tier 1 (rc) | HIL and conformance evidence |
| `edge-mqtt`, `edge-modbus` | Tier 1 (rc) | HIL and conformance evidence |

The current `scripts/workspace-gates.config.json` and `docs/maturity.md` predate
this tier model. Phase 0 A2 must reconcile them; until that happens, the tier
table in this section is the target, not a claim that the published matrix
already matches it.

---

## 5. Workstreams

The work is grouped so that Phase 0 can ship without waiting for security research
or hardware labs.

### A. Public truth and metadata (Phase 0)

| ID | Work | Done when |
|---|---|---|
| A1 | Correct README package/domain counts and `SDK_MANIFEST` counts | Counts are generated or CI-checked |
| A2 | Add a full maturity matrix for all 67 packages, including Tier 0/1/2 support scope | Every package has level, support tier, reason, owner, and evidence link |
| A3 | Rebuild the RFC index for RFC-037–063 and correct stale statuses | README/docs RFC tables match RFC front matter |
| A4 | Fix `SECURITY.md` supported versions and remove the PGP placeholder | No claims that contradict published versions |
| A5 | Add CI/release/coverage/audit badges | README shows current, clickable status |
| A6 | Regenerate TypeDoc and verify all packages are present | Docs build is part of release verification |
| A7 | Add a stale-claims verification script | CI fails on count/status drift |

### B. Security hardening (Phase 1)

| ID | Work | Done when |
|---|---|---|
| B1 | Public threat model: attackers, trust boundaries, key custody, replay/reorg, compromised components | Published 2026-10-25 in `docs/security/threat-model.md` and linked from `SECURITY.md`; external review remains part of B2 |
| B2 | Independent audit of current core, Omnia, KISSVM, lookup, storage, edge runtime | Audit published and findings triaged |
| B3 | Fuzz/property tests for wire parsers, tx builder, KISSVM, proofs, channel transitions, adapters | CI targets and invariants documented |
| B4 | Key recovery, rotation, lease recovery, compromise, and disaster-recovery runbooks | Tested procedures, not prose only |
| B5 | SBOM, signed artifacts, dependency/container scanning, reproducible builds | Automated and verifiable |
| B6 | Vulnerability process: real PGP/key path, severity taxonomy, advisory/CVE process, security changelog | `SECURITY.md` and advisories agree |
| B7 | Finish RFC-019 residual and land RFC-021/022/023 | RFCs move out of Draft with tests |
| B8 | Finish RFC-031 P5 and RFC-007 Phase 5/Phase 4 conformance | No ambiguous dual crypto/storage path |
| B9 | Policy receipts, simulation/dry-run, and physical-effect enforcement | Enforceable and auditable, not advisory |

### C. Testing and proof (Phase 1–2)

| ID | Work | Done when |
|---|---|---|
| C1 | Conformance suites for each promoted connector | Protocol-specific pass/fail tests |
| C2 | Hardware-in-the-loop lab for PLCs, sensors, BLE/CAN, robots | Documented rig and automated runs |
| C3 | Chaos/resilience: partitions, clock skew, crashes, power loss, duplicate/late messages | Failure semantics tested |
| C4 | Runtime matrix: Node, Bun, browser, Bare, Pear, Rust/WASM, JS fallback | CI compatibility matrix |
| C5 | Performance/load benchmarks and regression gates | Published baselines |
| C6 | Coverage targets for critical packages | CI-enforced thresholds |
| C7 | Cross-language parity gates for TS, Rust/WASM, and Go | Byte-exact vectors in CI |
| C8 | End-to-end verticals: cold chain, factory, EV charging, robotics, buildings | At least two full flows |
| C9 | Upgrade/rollback and version-skew tests | Persisted state survives |

### D. API and developer experience (Phase 2)

| ID | Work | Done when |
|---|---|---|
| D1 | Stable error model with codes, causes, remediation, docs links | Machine-usable errors |
| D2 | Strict schemas for config, policy, manifests, wire messages | Validation errors are explicit |
| D3 | Quickstarts and runnable examples for the production core | Examples run in CI |
| D4 | Glossary, architecture diagrams, trust-boundary diagrams | Newcomer can orient without RFCs |
| D5 | Deployment and operations guides for each production topology | Tested topologies |
| D6 | Privacy and operational-limits documentation | What is stored/transmitted/retained is explicit |
| D7 | Compatibility and deprecation policy | Semver and state/protocol compatibility rules |
| D8 | Migration guides only where deployed state exists | No hypothetical-user migration machinery |

### E. Release engineering (Phase 0–2)

| ID | Work | Done when |
|---|---|---|
| E1 | Predictable release cadence and user-facing release notes | Releases are scheduled |
| E2 | Automated versioning/changelog | Release-driven changelog |
| E3 | Maturity-aligned npm dist-tags | No alpha package on `latest` |
| E4 | Package consistency audit: exports, types, source maps, metadata, `files`, provenance | All public packages pass one contract |
| E5 | CODEOWNERS, issue/PR templates, changeset/test/docs requirements | Contribution quality is enforceable |
| E6 | Remove or quarantine dead code, stale extensions, deprecated packages | No ambiguous support surface |
| E7 | Reproducible and signed npm/GitHub/WASM artifacts | Third-party reproduction possible |

### F. Governance, edge, payments, and ecosystem (Phase 2–3)

| ID | Work | Done when |
|---|---|---|
| F1 | Harden recursive MAST/authority/governance and agent boundaries | Policy corpus passes |
| F2 | Promote 3–5 connectors from reference to stable | Conformance + HIL |
| F3 | Device onboarding, observability, deployment templates | Lifecycle tested |
| F4 | Harden `omnia-host` durability, restart, backup, monitoring, upgrades | Crash/restart tests |
| F5 | Routing/liquidity adversarial tests and economic security analysis | Failure modes covered |
| F6 | Testnet evidence before any mainnet claim | Published results |
| F7 | Roadmap, case studies, support channels, maintainer list, bug bounty | Visible accountability |
| F8 | README as one-screen product; docs site as the manual | Clear entry path |

---

## 6. Phases and exit criteria

### Phase 0 — Truth and trust (0–30 days, starts now)

**Scope:** A1–A7, E1–E4, and the Phase 0 portions of F8.

**Exit:**

- README, docs, `SDK_MANIFEST`, npm metadata, and RFC front matter agree.
- Every package has a maturity level, support tier and a reason.
- `SECURITY.md` has no stale version claim or placeholder key.
- CI fails on public-count/status drift.
- Release notes and dist-tags match the declared maturity.
- TypeDoc is regenerated and deployed for the release.

### Phase 1 — Security and durability (30–90 days)

**Scope:** B1, B3–B8, C3, C7, C9, E5–E7, F1, F4.

**Exit:** threat model, fuzz targets, crash/restart tests, parity gates, durable
host state, and policy/agent hardening are in CI.

### Phase 2 — Real-world proof (90–180 days)

**Scope:** B2, B9, C1–C6, C8, D1–D7, F2–F6.

**Exit:** independent audit published; 3–5 connectors stable with HIL/conformance;
two end-to-end verticals; testnet evidence; Tier 0 passes §3.2 and dependency
closure.

### Phase 3 — Ecosystem (180+ days)

**Scope:** E7, F7, F8, and ongoing audit/release cadence.

**Exit:** public case studies, external contributors/integrations, predictable
signed releases, and a docs site that is sufficient without reading RFCs.

---

## 7. Immediate Phase 0 checklist

- [x] Update `README.md` from 60/6 to 67/9 and fix the 55-package manifest line.
- [x] Add CI, Rust, and release badges.
- [x] Add RFC-063 to `README.md` and `docs/README.md`.
- [x] Correct RFC-018/019/020/032/033 status wording in the public RFC index.
- [x] Add RFC-037–062 to the public RFC index (or replace the table with a
      generated index).
- [x] Replace the seven-row maturity table with a generated full matrix.
- [x] Rewrite `SECURITY.md` supported versions for the pre-1.0 workspace.
- [x] Remove the placeholder PGP block and state the real encrypted-report path.
- [x] Regenerate TypeDoc and verify the docs build in CI.
- [x] Add `scripts/verify-public-claims.mjs` and run it in CI.
- [ ] Reconcile `scripts/workspace-gates.config.json`, `docs/maturity.md` and
      npm dist-tags with the Tier 0/1/2 model in §4.
- [ ] Publish release notes and set maturity-aligned npm dist-tags.

---

## 8. Non-goals

- Making every package Production.
- Adding new packages, protocols, or replication features before Phase 2.
- Renaming packages for presentation.
- Claiming “audited” without a current independent audit.
- Treating stars, forks, or package count as evidence of maturity.
- Declaring a package stable while its default path is Alpha/Beta/reference.

---

## 9. Open questions

1. Which 3–5 edge connectors are the first stable-promotion targets?
2. Which independent auditor and scope for Phase 2?
3. What support SLA can be honestly offered for Production packages?
4. What is the post-1.0 compatibility promise for persisted state and wire
   protocols?
5. Which token/economic disclosures are required before any production claim?
6. Should the full maturity matrix live in `README.md`, `docs/maturity.md`, or be
   generated into both?

---

## 10. Acceptance gate for this RFC

RFC-063 is **Landed** when:

1. Phase 0 has no unchecked checklist item.
2. `scripts/verify-public-claims.mjs` passes in CI.
3. Every publishable package has a maturity level, reason, and evidence link.
4. README, docs, manifest, npm metadata, and release tags agree.
5. The first Phase 1 workstream (threat model + fuzz targets) is scheduled with
   named owners.

Until then, the repository must not describe itself as production-ready as a
whole. It may describe the production core and the preview surface separately.
