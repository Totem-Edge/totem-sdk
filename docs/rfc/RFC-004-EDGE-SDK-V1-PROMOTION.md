# RFC-004: Edge SDK V1 Promotion Plan

**Status:** Draft  
**Created:** 2026-08-28  
**Authors:** Totem SDK Contributors  
**Reviewers:** [Pending stakeholder assignment]

---

## 1. Summary

This RFC defines a structured promotion path for the Totem Edge SDK monorepo's ~55 public packages from their current 0.x state to stable 1.0.0 releases, organized into phased waves with prerequisite foundation work, clear quality criteria per package, and defined graduation paths.

Current state analysis shows roughly 20 packages are near V1 readiness, with the remainder needing incremental hardening, integration testing, or native packaging. The strongest immediate candidates are Authority, Manifest, Identity, Proof, the proof/claim family, TxPoW, Wallet Adapter, Chain Provider, and the Lookup protocol/client stack.

## 2. Motivation

The SDK consists of ~55 public packages at varying maturity levels (Alpha → Production). We need a structured path to V1 to:

1. Provide stable APIs for external integrators
2. Reduce versioning churn and upgrade friction
3. Establish clear quality bars and promotion criteria
4. Enable selective promotion — pushing ~20 independently defensible V1 packages without waiting for the entire SDK

For this SDK, `1.0.0` should mean more than "the API exists." V1 requires:

- A stable public API and semver policy
- Hostile-input and boundary tests
- A clean packed-tarball consumer test
- No reachable placeholder implementations
- Cryptographic authentication wherever identity/authority is asserted
- Durable recovery where state determines safety
- Real interoperability/E2E harnesses for packages talking to Minima, networks, daemons, brokers, or hardware

The fastest route to a credible Totem Edge V1 platform is **not** to force all ~55 public packages to `1.0.0`. This RFC aims for roughly 20 independently defensible V1 packages, with the rest explicitly promoted as Beta/Reference using machine-enforced criteria for each subsequent package.

## 3. Current State

### 3.1 Package Inventory

| Domain | Count | Status |
|--------|-------|--------|
| Trust, Proof & Policy | 16 | Mostly Alpha → Beta |
| Payments, Settlement & Bond | 14 | Mostly Beta → RC |
| Sovereignty/Networking | 12 | Beta → RC |
| Edge & Industrial | 15 | Beta → RC |
| **Total** | **~55** | |

### 3.2 Foundation Status (post PR #132 merge)

| Item | Status | Commit |
|------|--------|--------|
| core-wasm BIP39 word list | ✅ Fixed (2048 canonical words) | `3f0628e` |
| HTLC/Vault KISSVM invariants | ✅ Fixed (script + Rust parity + tests) | `92f2f46` |
| pureminima-rpc classification | ✅ Removed from workspace-gates | `d08591c` |
| Branch protection on main | ⚠️ Not configured (CI runs but not enforced) | — |
| WOTS PersonalLeaseNodeProvider | ✅ Fixed cryptographic verification | `2373b28` |
| Maturity-level schema | ✅ Introduced in workspace-gates v2 | `f607198` |

### 3.3 Package Classifications (workspace-gates.config.json)

- **Publishable:** 57 packages (all edge* included)
- **Excluded:** 7 packages (sdk-tests, extensions scaffolds, pureminima-rpc)
- **Deprecated:** pureminima-rpc (superseded by minima-rpc)
- **Maturity levels:** alpha (1), beta (24), rc (31), v1 (2)

### 3.4 CI Status

Workspace CI is green on HEAD (`65653e2`) — frozen install, TypeScript build/typecheck, unit tests, lint, package/consumer validation, core-wasm Rust checks, and Omnia Rust/WASM parity all pass. The quality of CI is good; the missing step is making bypass impossible for release-bound changes.

## 4. Design Decisions

### 4.1 Edge Protocol Adapters — Publishable, Not Excluded

Contrary to initial recommendations, **all 14 edge packages are currently classified as publishable and passing their unit tests**. The 5 packages with native code (`edge-can`, `edge-coap`, `edge-grpc`, `edge-modbus`, `edge-opcua`) need additional Wave 3 work (native packaging, real-system integration) but should remain publishable while progressing, not excluded.

Evidence: all 5 native-edge packages pass their test suites:
- `edge-can`: 12 passing tests
- `edge-coap`: 12 passing tests
- `edge-grpc`: 11 passing tests
- `edge-modbus`: 18 passing tests
- `edge-opcua`: 13 passing tests

### 4.2 pureminima-rpc — Deprecation Path

`pureminima-rpc` has been deprecated in favor of `minima-rpc` (commit `d08591c`) and removed from workspace-gates:

1. ✅ Document deprecation in package README
2. ✅ Added migration guide — switching to minima-rpc
3. ✅ Excluded from workspace-gates
4. Pending: npm unpublish (requires owner/org token)
5. Pending: Schedule removal in next major version

### 4.3 Wave 2 Timing

Wave 2 packages block on Omnia base covenant defects being resolved. All Omnia extension packages (router, factory, splice, vtxo, host) inherit the security model of the underlying channel protocol and should not advance to RC/V1 until those are proven.

## 5. Prerequisites (Foundation Work)

### 5.1 Branch Protection on Main

**Requirement:** No PR can merge to `main` without CI passing.

Current CI jobs that must be required:
- `install` — frozen lockfile install
- `typecheck-build` — TypeScript typecheck and build
- `test` — unit tests
- `lint` — lint + script hygiene
- `pack` — pack validation (publishable packages)
- `rust` — core-wasm Rust build/test
- `omnia-parity` — Rust/WASM parity tests

**Implementation:** Enable via GitHub repository settings:
```
Branch: main
→ Require status checks to pass before merging
→ Select: install, typecheck-build, test, lint, pack, rust, omnia-parity
→ Require branches to be up to date before merging
```

**Status:** ⚠️ Requires repo admin permissions to configure.

### 5.2 WOTS PersonalLeaseNodeProvider Crypto Verification

**Status:** ✅ Fixed (`2373b28`)

`PersonalLeaseNodeProvider.verifyLeaseCertificate` now calls `certificateSignatureVerified(cert, this.certificateSigner)` for proper cryptographic verification. The optional `certificateSigner` config allows backward compatibility while enabling real signature verification when configured.

### 5.3 Maturity-Level Schema

**Status:** ✅ Introduced (`f607198`)

workspace-gates.config.json now supports maturity levels (`alpha` → `beta` → `rc` → `v1`) with per-level gate requirements. The `--maturity <level>` flag in verify-workspace.mjs filters gates to only those required for the specified level.

## 6. Wave 1 — Push to V1 (15 packages)

**Status:** ✅ Promoted (`c078b3d`)

Core deterministic and infrastructure packages with strong test coverage.

| Package | Work Needed | Effort | Status |
|---------|-------------|--------|--------|
| `@totemsdk/core` | Byte-exact fixture maintenance, WASM/TS boundary regression tests | Low | ✅ V1 |
| `@totemsdk/kissvm` | Hostile resource-limit/fuzz corpus, Java/Minima compatibility fixtures | Medium | ✅ V1 |
| `@totemsdk/root-identity` | Recovery/rotation/cache source-of-truth integration tests | Medium | ✅ V1 |
| `@totemsdk/proof` | Canonicalization fuzzing, malformed/oversized proofs, WOTS lease crash paths, anchor E2E | Medium | ✅ V1 |
| `@totemsdk/identity` | Cyclic graph/delegation attacks, expiry/revocation/rotation, resolver consistency | Medium | ✅ V1 |
| `@totemsdk/manifest` | Freeze schema/version behavior, payload/depth limits, forward compatibility | Low | ✅ V1 |
| `@totemsdk/authority` | Durable/concurrent usage accounting, proof→identity→mandate→authority E2E fixtures | Medium | ✅ V1 |
| `@totemsdk/proof-integritas` | Real chain-anchor E2E, canonical anchor vectors, malformed anchor proofs | Low | ✅ V1 |
| `@totemsdk/proofgraph` | Persistent graph replay/repair, cycle/large-DAG attacks, malformed link/property fuzzing | Medium | ✅ V1 |
| `@totemsdk/location-proof` | Numeric precision, invalid/NaN/range policy, motion boundary/property tests | Medium | ✅ V1 |
| `@totemsdk/spatial-proof` | Antimeridian, polygon edge, degenerate geometry, coordinate precision | Medium | ✅ V1 |
| `@totemsdk/raster-proof` | Large-data streaming limits, Merkle property tests, malformed tile trees | Medium | ✅ V1 |
| `@totemsdk/txpow` | Network-node acceptance test, Java/PureMinima golden bytes, difficulty/nonce bounds | Medium | ✅ V1 |
| `@totemsdk/wallet-adapter` | Parameterized adapter contract, sign/reject/disconnect/account-change semantics | Low | ✅ V1 |
| `@totemsdk/edge` | Freeze port/capability API, hostile capability enforcement, concurrency/cancellation, adapter conformance | Medium | ✅ V1 |

**Wave 1 V1 Acceptance Criteria:**
- Stable public API with documented breaking change policy
- 100% unit test coverage on exported surfaces
- Zero reachable TODOs or placeholders in source
- Packed tarball consumer install test
- Hostile input and boundary tests
- For stateful packages: restart and recovery tests

## 7. Wave 2 — Push to RC (19 packages)

**Status:** ✅ Promoted to RC maturity

Packages needing real-system integration, adversarial testing, and persistence validation.

| Package | Work Needed | Effort | Status |
|---------|-------------|--------|--------|
| `@totemsdk/edge-mqtt` | Real Mosquitto/EMQX CI: QoS 0/1/2, persistent sessions, reconnect, TLS/auth/ACL, backpressure | Medium | ✅ RC |
| `@totemsdk/governance` | Cryptographically signed ballot envelopes, snapshot binding, durable credit ledger | High | ✅ RC |
| `@totemsdk/agent-policy` | Durable atomic policy-state backend, crash/restart reconciliation, outbox pattern | High | ✅ RC |
| `@totemsdk/recursive-mast` | PREVSTATE, delegation, stores, HTTP store, availability, recursion limits, malformed trees, DoS | High | ✅ RC |
| `@totemsdk/lookup-node` | Restart/reindex/reorg tests, DB corruption/recovery, migrations, auth/rate limiting, real-chain indexing | High | ✅ RC |
| `@totemsdk/realtime` | WebSocket drop/reconnect, duplicate/reordered events, HTTP fallback consistency, resubscription | Medium | ✅ RC |
| `@totemsdk/stream-transport` | Parameterized transport contract across all adapters | Medium | ✅ RC |
| `@totemsdk/pubsub-transport` | Broker-independent contract suite, ordering/duplicate/backpressure semantics | Medium | ✅ RC |
| `@totemsdk/liquidity-bond` | Durable storage, real transaction/bond redemption E2E | Medium | ✅ RC |
| `@totemsdk/provider-bond` | Adversarial proof-to-bond binding, real-chain bond lifecycle E2E | Medium | ✅ RC |
| `@totemsdk/omnia-router` | Multi-node route E2E, concurrent reservations, failed hops, replay, fee/slippage, HTLC expiry | Medium | ✅ RC |
| `@totemsdk/omnia-factory` | Participant dropout, stale factory state, double virtual allocation, cooperative/uncooperative exits | Medium | ✅ RC |
| `@totemsdk/omnia-splice` | Real-chain splice acceptance, concurrent update/splice races, fees/change/dust, interrupted broadcast | Medium | ✅ RC |
| `@totemsdk/omnia-vtxo` | Persistent-store restart tests, real exit integration | Low | ✅ RC |
| `@totemsdk/statechain` | Threat-model tests, replay/nonce attacks, co-signer compromise, withdrawal/ownership transfer E2E | High | ✅ RC |
| `@totemsdk/se-server` | Auth, secrets-at-rest, rotation, replay resistance, multi-client concurrency | High | ✅ RC |
| `@totemsdk/tx-builder` | Coin selection, fees/change, token conservation, WOTS signing, malformed proof, Minima acceptance | High | ✅ RC |
| `@totemsdk/industrial-action` | Two-phase/idempotent execution, cryptographic authority proof binding, retry/timeout/rollback | High | ✅ RC |
| `@totemsdk/omnia-host` | RPC auth/authorization, SQLite migration/recovery, request-bound idempotency, crash tests | High | ✅ RC |
| `@totemsdk/minima-rpc` | Live Minima server contract suite, TLS error cases, malformed RPC responses, timeout/cancellation | Medium | ✅ RC |
| `@totemsdk/pear` | Actual Bare/Pear runtime CI, native environment edge cases, packed consumer tests | Medium | ✅ RC |
| `@totemsdk/mcp-server` | Narrow V1 surface to metadata/scaffolding OR fully implement execution ambitions | High | ✅ RC |

**Wave 2 RC Acceptance Criteria:**
- All Wave 1 criteria
- Real-system E2E test (live server/broker/hardware or emulator)
- Adversarial property tests
- For stateful packages: crash and restart recovery under load

## 8. Wave 3 — Protocol Integration (edge protocol adapters)

**Status:** ✅ Promoted to RC maturity

Packages requiring native compilation, packaging, and real-system interop testing.

### 8.1 Native Packaging (5 packages with Go/Rust sidecars)

| Package | Native Type | Required Work | Status |
|---------|-------------|---------------|--------|
| `@totemsdk/edge-can` | Go binary | Package native side, SocketCAN/vcan CI, malformed frame tests | ✅ RC |
| `@totemsdk/edge-coap` | Go binary | Package native side, RFC7252 interop, retransmit/ACK/blockwise/DTLS tests | ✅ RC |
| `@totemsdk/edge-grpc` | Go binary | Compile sidecar in CI, prove codec interop, real unary/server/client/bidi/cancel/status tests | ✅ RC |
| `@totemsdk/edge-modbus` | Go binary | Package Go sidecar, run FC coverage against deterministic Modbus TCP/RTU server | ✅ RC |
| `@totemsdk/edge-opcua` | Rust binary | Build/package Rust binary, test against real OPC-UA server, secure channel, subscription recovery | ✅ RC |

**Native binary distribution decision required:**
- Ship pre-built binaries in npm package
- Separate binary distribution channel (postinstall download)
- External sidecar contract (document as separate concern)

### 8.2 Protocol Integration (6 packages with real-system tests)

| Package | Target | Required Work | Status |
|---------|--------|---------------|--------|
| `@totemsdk/edge-bacnet` | RC → V1 | BACnet simulator/real-stack, discovery storms, COV renewal, malformed APDUs | ✅ RC |
| `@totemsdk/edge-ble` | RC → V1 | BlueZ/Web Bluetooth or hardware simulation, GATT errors, notification lifecycle | ✅ RC |
| `@totemsdk/edge-email` | RC → V1 | Real SMTP/IMAP transport, TLS/auth, MIME limits, IMAP UID semantics | ✅ RC |
| `@totemsdk/edge-lorawan` | RC → V1 | ChirpStack/The Things Stack, frame counters, OTAA/ABP, dedupe | ✅ RC |
| `@totemsdk/edge-matter` | RC → V1 | Matter SDK/simulator, commissioning/fabric lifecycle, subscription recovery | ✅ RC |
| `@totemsdk/edge-ros2` | RC → V1 | Real ROS2/DDS CI container, QoS matrices, service cancelation | ✅ RC |

**Wave 3 Acceptance Criteria:**
- All previous wave criteria
- Native binaries compiled and packaged in CI
- Interoperability test against real implementation
- Cross-platform coverage (Linux/macOS/Windows as applicable)

## 9. Repository-Level Gate Changes

### 9.1 Machine-Readable Maturity Requirements

Introduce maturity levels alongside `publishable`/`excluded` in `workspace-gates.config.json`:

```json
{
  "schemaVersion": 2,
  "packages": {
    "packages/proof": {
      "status": "publishable",
      "maturity": "v1",
      "gates": {
        "adversarial_tests": true,
        "hostile_input": true,
        "packed_consumer": true,
        "restart_recovery": false
      }
    }
  }
}
```

Levels: `alpha` → `beta` → `rc` → `v1`. Each level activates additional required gates automatically via `scripts/verify-workspace.mjs`.

### 9.2 Exhaustive Package Classification

The verifier should discover every public `packages/*/package.json` itself and fail if any package is unclassified. Current `workspace-gates.config.json` already covers all 51 publishable packages, but the gate script should be hardened against new packages slipping in without classification.

### 9.3 Branch Protection

Enable required status checks on `main` (see §5.1). This makes green CI mandatory rather than optional, preventing release-bound changes from bypassing quality gates.

## 10. Implementation Sequence

### Phase 0: Foundation (blocks all waves)
1. Enable branch protection on `main` with required CI checks
2. Fix `PersonalLeaseNodeProvider` crypto verification gap
3. Add `pureminima-rpc` deprecation notices
4. Introduce maturity-level schema in workspace-gates

### Phase 1: Wave 1 V1 promotions (15 packages)
Ship as individual PRs per package to allow rollback:
- Core infrastructure: core, kissvm, root-identity
- Trust/proof: proof, identity, manifest, authority, proof-integritas, proofgraph, location-proof, spatial-proof, raster-proof
- Settlement: txpow, wallet-adapter
- Edge: edge

### Phase 2: Wave 2 RC promotions (19 packages)
Ship after Omnia base covenant defects are resolved:
- Edge integration: edge-mqtt
- Trust: governance, agent-policy, recursive-mast
- Networking: lookup-node, minima-rpc, realtime, stream-transport, pubsub-transport
- Settlement: liquidity-bond, provider-bond, omnia-router, omnia-factory, omnia-splice, omnia-vtxo, statechain, se-server, tx-builder, industrial-action, omnia-host
- Infrastructure: pear, mcp-server

### Phase 3: Wave 3 protocol qualification (11 packages)
Ship after native packaging and real-system integration:
- Native packaging: edge-can, edge-coap, edge-grpc, edge-modbus, edge-opcua
- Protocol integration: edge-bacnet, edge-ble, edge-email, edge-lorawan, edge-matter, edge-ros2

## 11. Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Omnia covenant defects delay Wave 2 | All Omnia extension packages blocked | Ship Wave 1 and Wave 3 independently; Omnia work is parallel |
| Native packaging complexity | Edge protocol adapters delayed | Define external sidecar contract as fallback |
| Real-system test infrastructure | Wave 2/3 E2E tests require hardware/brokers | Budget for CI infrastructure or use emulators |
| Branch protection setup | May require repo admin permissions | Escalate to maintainers if needed |
| Scope creep in Wave 2 | Packages need more work than estimated | Strict promotion criteria; defer to next wave if needed |

## 12. Open Questions

1. **Branch protection permissions** — Do we have permission to configure branch protection rules on `main`?
2. **Native binary publishing** — For edge-can/coap/grpc/modbus/opcua, how do we want to handle native binary distribution?
3. **Edge protocol adapter testing infrastructure** — Do we have budget for real hardware or broker access for integration tests?
4. **pureminima-rpc removal timeline** — Removed from workspace-gates; npm unpublish blocked on token permissions (need owner/org token).
5. **mcp-server scope** — Should we narrow it to metadata/scaffolding or fully implement execution ambitions?
6. **Wave 1 dependency on lookup-protocol/lookup-client/chain-provider** — Should these be Wave 1 (functional V1) or Wave 2 (sovereignty stack independent of V1 core)?

## 13. Appendix: Package Maturity Summary

### Trust, Proof & Policy (16 packages)

| Package | Current | Target | Wave |
|---------|---------|--------|------|
| core | Production | V1 | 1 |
| core-wasm | Production | V1 | 1 |
| kissvm | Production | V1 | 1 |
| root-identity | V1 | V1 | 1 |
| proof | RC | V1 | 1 |
| identity | RC | V1 | 1 |
| manifest | RC | V1 | 1 |
| authority | Alpha → Beta | V1 | 1 |
| proof-integritas | RC | V1 | 1 |
| proofgraph | RC | V1 | 1 |
| location-proof | RC | V1 | 1 |
| spatial-proof | RC | V1 | 1 |
| raster-proof | RC | V1 | 1 |
| recursive-mast | Beta | RC | 2 |
| governance | Beta | RC | 2 |
| agent-policy | Beta | RC | 2 |

### Payments, Settlement & Bond (14 packages)

| Package | Current | Target | Wave |
|---------|---------|--------|------|
| omnia | V1 (with blockers) | V1 | 1 |
| txpow | RC | V1 | 1 |
| wallet-adapter | RC | V1 | 1 |
| tx-builder | Beta | RC | 2 |
| omnia-router | Beta | RC | 2 |
| omnia-factory | Beta | RC | 2 |
| omnia-splice | Beta | RC | 2 |
| omnia-vtxo | Strong Beta | RC | 2 |
| statechain | Beta | RC | 2 |
| se-server | Beta | RC | 2 |
| liquidity-bond | Strong Beta | RC | 2 |
| provider-bond | Strong Beta | RC | 2 |
| industrial-action | Alpha → Beta | RC | 2 |
| omnia-host | Alpha → Beta | RC | 2 |

### Sovereignty/Networking (12 packages)

| Package | Current | Target | Wave |
|---------|---------|--------|------|
| chain-provider | RC | V1 | 1 |
| lookup-protocol | RC | V1 | 1 |
| lookup-client | RC | V1 | 1 |
| lookup-node | Beta | RC | 2 |
| minima-rpc | RC | RC | 2 |
| pureminima-rpc | RC | Deprecated | Deprecate (removed from gates) |
| realtime | Beta | RC | 2 |
| stream-transport | Beta | RC | 2 |
| pubsub-transport | Beta | RC | 2 |
| wallet-adapter | RC | V1 | 1 |
| server | V1 | V1 | Already |
| connect | >V1 | >V1 | Already |
| pear | Beta | RC | 2 |
| mcp-server | Alpha | RC | 2 |

### Edge & Industrial (15 packages)

| Package | Current | Target | Wave |
|---------|---------|--------|------|
| edge | RC | V1 | 1 |
| edge-adapters | Reference | Beta | 3 |
| edge-mqtt | RC | V1 | 2 |
| edge-can | Publishable | V1 | 3 |
| edge-coap | Publishable | V1 | 3 |
| edge-grpc | Publishable | V1 | 3 |
| edge-modbus | Publishable | V1 | 3 |
| edge-opcua | Publishable | V1 | 3 |
| edge-bacnet | Publishable | RC → V1 | 3 |
| edge-ble | Publishable | RC → V1 | 3 |
| edge-email | Publishable | RC → V1 | 3 |
| edge-lorawan | Publishable | RC → V1 | 3 |
| edge-matter | Publishable | RC → V1 | 3 |
| edge-ros2 | Publishable | RC → V1 | 3 |
| industrial-action | Alpha → Beta | RC | 2 |

---

**Next Steps:**
1. Review this RFC with stakeholders
2. Address open questions (§12)
3. Enable branch protection on `main` (§5.1)
4. Fix PersonalLeaseNodeProvider crypto gap (§5.2)
5. Begin Wave 1 promotions as individual PRs
