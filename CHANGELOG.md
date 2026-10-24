# Changelog

All notable changes to the Totem SDK will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **`@totemsdk/lookup-node` 0.3.0 — durable session tickets:** ticket state now
  persists in SQLite (`totem_lookup_ticket:v1:*`) and is restored on startup.
  The per-ticket `seq` watermark, request budget and revocation survive a node
  restart; tickets minted by another node or corrupt entries are discarded.
  Added a node-restart E2E that reuses a ticket and rejects its replay.

- **`@totemsdk/connect` 3.1.1 — `TOTEM_GET_CHAIN_TIP`:** added the extension's
  existing chain-tip request to the shared connect inventory with a typed
  request/response, `chain.getTip` handler, and runtime provider method.

- **`@totemsdk/edge` 1.4.0:** refreshed the optional `@totemsdk/connect` peer
  range to `^3.1.1` after the connect 3.x breaking release.

- **`@totemsdk/wallet-adapter` 2.0.1:** added the required
  `getChainTip()` runtime provider method and `TOTEM_GET_CHAIN_TIP` origin
  check, restoring TypeScript compatibility with `@totemsdk/connect` 3.1.x.

- **`@totemsdk/proof` 1.0.1:** republished against the current
  `@totemsdk/manifest` 2.x and `@totemsdk/identity` APIs, closing the last
  CAN-009 flat-install manifest split.

### Fixed

- **`@totemsdk/storage` FileStore CAS lost updates:** concurrent
  `conditionalUpdate` calls across separate `FileStore` instances could both
  report success while one write was lost. Added in-process per-lock
  serialization, safer orphan-lock recovery, and retry handling when a stale-lock
  steal races `mkdir`. The AUD-033 conformance test now passes repeatedly.

### Changed

- **`@totemsdk/storage` 0.2.0 promoted to rc (Tier 1):** the synchronous SQLite
  adapter and `omnia-host` 0.12.0 durable state adoption have landed. Remaining
  evidence is crash/power-loss recovery and broader backend parity; no
  production claim yet.

- **Terminology:** replaced every `WOTS+` reference with `WOTS` across the SDK,
  documentation and generated API text. Minima uses regular WOTS, not the WOTS+
  variant.

### Security

- **`@totemsdk/manifest` 2.0.2 — author-address binding:** `verifyManifest` now
  derives the signer address from `signerPublicKey` and requires both the wrapper
  `authorAddress` and the manifest's declared author/agent/operator address to
  match it. This closes a High-severity impersonation path where a signer could
  declare a victim address and copy it into the wrapper. Rust/WASM verification
  has the same parity fix.

### Changed

- **Omnia `payMultiHop` contract (breaking):** `connect`, `omnia-relay` and
  `omnia-host` now share one intent-based request:
  `{ toPartyId, amount, tokenId, hashlock, preimage?, expiryBlock, maxHops?, route?, targetTokenId? }`.
  The old route-only connect shape and relay `timeoutBlock`/first-hop response
  contract are removed. Relay responses add `preimage`/route metadata; host
  executes full routes and cross-token routes from the same request.

- **`@totemsdk/connect` / `@totemsdk/wallet-adapter`:** added the missing
  `TOTEM_SIGN_MESSAGE` descriptor and handler to the shared wallet runtime. The
  canonical connect surface is now 48 methods; wallets without a message-signing
  port report an explicit `UNSUPPORTED` reason.

- **`@totemsdk/entity` — breaking projection change:** the `minimal` mode now
  discloses **no sections**, including no root address and no `entityRef`.
  `EntityView.root` is optional and appears only when root is explicitly
  requested. This closes the implicit root leak in the least-disclosing mode.
  The package version must be bumped before release.

- **Ownership and support:** added a default `CODEOWNERS` owner and aligned
  `SUPPORT.md` / `SECURITY.md` with the RFC-063 Tier 0/1/2 support model. Tier 1
  packages are explicitly best-effort, not production support.

- **Package metadata gate:** publishable packages must now match the root
  `license` and include both `LICENSE` and `NOTICE` in their published `files`.

- **License:** new releases are licensed under Apache-2.0. Added a root `NOTICE`
  covering Minima, Bouncy Castle, QVAC, Google Protocol Buffers, BIP39 and
  Contributor Covenant attribution. Package `LICENSE`, `NOTICE`, `package.json`,
  Cargo metadata and SBOM metadata are aligned. Releases previously published
  under MIT remain available under their original license.

### Added

- **`@totemsdk/agent-policy` — run-level autonomy over existing mandates**
  - `GrantBoundAutonomyPolicy` — `openRun`, `authorizeAndReserve`, `commit`/`abort`, `getRunReceiptGraph`. Effective authority = signed mandate ∩ local autonomy profile ∩ verified operation effects ∩ current run state.
  - `createAutonomyPolicy` + `AutonomyProfile` — configurable profiles (`dynamic` / `declared_plan` / `locked_plan` / `single_step`) with run limits (steps, parallelism, failures, duration, gross spend, fees, channel exposure), transition DAGs, obligations (simulation/quote/receipt/postconditions), and explicit `allOf`/`anyOf` grant-set composition.
  - `reduceToCanonicalAction` — reduce a prepared operation to canonical security facts; agent-supplied hints are never security facts.
  - Boundary escalation returns a structured `requires_human` with a narrow, expiring, run-bound `suggestedGrant` — never a silent bypass.
  - `SqliteRunStateStore` — durable SQLite (WAL) store implementing both `RunStateStore` and `GrantUsageStore`; one atomic transaction reserves mandate usage, run budgets, concurrency slot, and nonce. Durable across restarts.

- **`@totemsdk/omnia-pool` — autonomous rebalance execution wiring**
  - `executeAutonomousRebalanceStep` — the vertical slice: prepare (buildUpdateTx/buildFundingTx) → reduce → authorize → execute (channel update + `rebalancePoolCapital`) → commit with tx-digest proof / abort on failure. Channel-internal outputs are state changes, not external spends.

- **`@totemsdk/edge` — universal action registry + governed agent facade**
  - `createEdgeActionRegistry` — `EdgeActionDefinition { capability, effect, prepare, deriveEffects, execute }` with exact + prefix (`omnia:*`) resolution; explicit `UNGRANTABLE_ACTIONS` deny-list (seed export, raw signing, key-lease ops, policy replacement, raw port handles, identity-root rotation).
  - `createBuiltinActionDefinitions` — canonical namespaces for every domain: `payment:send`, `omnia:*` (12 ops), `proof:create/verify`, `lookup:query/announce`, `location:claim:create/trail:create/proof:create`, `identity:resolve/verify`, `manifest:sign/verify`, `liquidity:balance:read/utxo:read`, `transport:publish/subscribe/send`.
  - `createAgentEdgeRuntime` — governed facade exposing **only** `executeAction` (never the raw ports); pipeline = ungrantable check → resolve → capability → prepare → deriveEffects → `GrantBoundAutonomyPolicy` authorizeAndReserve → execute → commit/abort.
  - `prepared-effects` — effects derived from the **real built transaction** (change and channel-internal outputs excluded from spends); the committed receipt reflects the real spend, not the agent's claimed amount.
  - Key-lease lifecycle (`reserve → sign → commit/burn`) is an internal consequence of authorized signing actions, never an agent-callable action.

- **`@totemsdk/omnia` 2.3.0 — PQ-bound native transport identity and resilient peer messaging**
  - `transportPubkey` on channel/factory participants, derived from the host seed and bound by the identity-signed manifest; `OmniaSwarm.connectToPeer` matches the expected transport key and re-keys the peer under the Omnia identity.
  - Native DHT bootstrap options (`OMNIA_DHT_BOOTSTRAP`, `OMNIA_DHT_HOST`/`OMNIA_DHT_PORT`); Hyperswarm now receives an explicitly constructed `hyperdht` instance and the same derived keypair.
  - `onFactoryMessage`/`onVcMessage` integration hooks and forwarding of every inbound message to integration listeners (relay and Hyperswarm).
  - `NodeStreamTransport` exposes stream-open readiness.

- **`@totemsdk/omnia-factory` 0.7.0 — real factory funding, settlement, and virtual-channel lifecycle**
  - On-chain funding witness assembled from per-participant `CoinProof` + `ScriptProof` + a signature over the canonical TX digest; funding coin id is derived from the funding material and settlement uses canonical digests.
  - N-of-N settlement witness (factory coin proof + script proof) submitted via `txnmine`/`sendtransaction`.
  - Two-phase `build`/`sign`/`assembleVirtualChannelClose` for virtual-channel closure.

- **`@totemsdk/omnia-host` 0.10.0 — two-node factory, virtual-channel, splice, and cooperative settlement**
  - Local factory lease bundles; `FACTORY_PROPOSAL`/`FACTORY_ACCEPT` and `VC_PROPOSAL`/`VC_ACCEPT`/`VC_FINALIZED` coordination.
  - Two-phase `createFactory`, `openVirtualChannel`, and `closeVirtualChannel`; `closeFactory` accepts the factory coin proof.
  - `createFactory` accepts per-participant funding material (coin/script proofs plus local and remote co-signers); `closeFactory` performs cooperative two-host settlement via `FACTORY_CLOSE_PROPOSAL`/`FACTORY_CLOSE_ACCEPT`/`FACTORY_CLOSE_FINALIZED`.
  - S7 splice coordination is wired into the host lifecycle and control API.

- **`@totemsdk/omnia-router` 0.4.0 — bounded routing engine**
  - Layered `(hops, node)` search plus zero-fee BFS, fixing the hop-constrained label bug.
  - Global cross-token hop budget with one inbound tree and cached outbound legs.
  - Candidate routes are revalidated against live channels before any HTLC lock.

- **`@totemsdk/eefi` 0.1.0 — generic Eefi contracts (RFC-053)**
  - New data-only package (core-only dependency) for `EefiCapitalAgreement`, `EefiMarketAgreement`, `EefiRiskPolicyRef`, and `EefiExerciseCovenant` with domain-separated canonical digests and fail-closed validation.
  - Covenant builders remain in `@totemsdk/kissvm`; this package performs no money movement, script construction, or policy evaluation.

- **`@totemsdk/entity` 0.1.0 — disclosure-bounded entity resolution (RFC-056)**
  - `resolveEntity()` composes identity, an optional signed manifest, an optional root-ownership proof, and pre-verified authority grants into one resolution at an explicit `asOf`.
  - `projectEntity()` produces `minimal`, `available`, or `purpose-bound` views across disclosure levels 0–5 (root, children, identity, manifest, claims, authority).
  - Absence of disclosure is reported as `unknown`, never `invalid` or `false`; invalid manifests/proofs/grants are reported without falling back to raw data.
  - Includes canonical view digests, a metadata allow-list, and an opaque `entityRef` that avoids disclosing semantic identity in minimal views.

- **`@totemsdk/root-identity` 1.0.10 — structural root-binding verifier**
  - New `createRootIdentityProofVerifier()` plus `encodeRootIdentityProof()` / `decodeRootIdentityProof()` for verifying an `OwnershipProof` without importing the wallet implementation.
  - `expectedRootAddress` binding is enforced; proven children are returned as evidence only and never grant `manifest:sign` or authority.

- **`@totemsdk/manifest` 2.0.1 — content-addressed revisions and transport key**
  - `computeManifestEnvelopeId()` gives a stable identity to manifest revisions (RFC-056 P0-E).
  - `EdgeServiceManifest.transportPubkey` carries the classical routing key bound by the manifest's PQ signature.

- **`@totemsdk/omnia-relay` 0.5.0 — self-hosted relay server**
  - New `@totemsdk/omnia-relay/server` entry point for running a relay instead of depending on a hosted endpoint.

- **`@totemsdk/lookup-client` (Go) — RFC-032-A session tickets**
  - The Go client performs one `SESSION_OPEN` (one WOTS use) and reuses a node ticket for non-high-value messages with a monotonic `seq`; `BROADCAST_TXPOW`, lease and announce types still require a full envelope.
  - Ticket expiry, budget exhaustion, and `SESSION_EXPIRED`/`AUTH_REPLAY` trigger a single background reopen; a failed open falls back to per-message WOTS. Covered by `go test`.

- **`@totemsdk/lookup-node` (Go) — RFC-032-A ticket minting**
  - `SESSION_OPEN` verifies the WOTS envelope, claims the replay nonce, and mints a node-signed ticket; the in-memory ticket store enforces expiry, budget, per-ticket `seq` monotonicity and revocation.
  - Ticket refs authenticate non-high-value messages; lease/broadcast/announce types still require a full envelope. `SESSION_CLOSE` revokes. Covered by `go test`.

### Changed

- **`@totemsdk/decision` 0.2.0** — bounded-decisions hardening: runtime-owned hard cancellation (caller abort / `decision:cancel` / timeout all race the provider); operation vs target confidence split (`operationConfidence`/`targetConfidence`, `confidence` retained as the operation alias); action operation/target distribution completeness with provider-declared `distributionTolerance` (Laya/Jev 0.02) and `choiceSelection: 'argmax'` enforcement; target-head goal/operation context; intelligence-fallback semantic preservation; Edge failure provenance + capability narrowing; normalized provenance (result == receipt, receipt carries `upstreamRequestId`); closed-set `isDecisionCapability`; non-empty request-id validation; explicit `minOperationProbability`/`minTargetProbability`.
  - **Breaking within 0.x:** for actions, `minSelectedProbability` and `requireProbabilities` now cover the selected target as well as the operation; Laya/Jev complete distributions are validated strictly (coverage, sum, argmax).

- **`@totemsdk/wallet-adapter` 2.0.0 — bound to the connect/wallet runtime**
  - The base class now composes `createWalletRuntime`: fail-closed approvals, trusted-origin resolution, input authorization, verify domain/replay checks and sessions, WOTS lease port, all 47 connect methods via optional ports, the full `TotemProvider` shape, and a per-method support manifest.
  - Custody defaults are safe (`false`/`hosted`); unknown methods return `UNSUPPORTED`. A wallet-adapter parity gate is wired into CI.
  - **Breaking:** approval-gated methods require an `approve` callback.

- **`@totemsdk/omnia-router` 0.4.0 — routing behaviour** — pathfinding now uses the bounded layered engine and live route revalidation, so path selection and cost accounting differ from 0.3.x. The internal `RoutingEngine` is not exported yet.

- **`@totemsdk/core-wasm` 1.0.3 — Bare runtime support**
  - The generated Node glue falls back from `node:fs` to optional `bare-fs` and installs `bare-encoding/global` when the encoding globals are absent. `prepare-publish-assets.mjs` reapplies the patch after every wasm build.
  - `@noble/hashes` is patched so `node:crypto` is optional and `globalThis.crypto` is the fallback. `pkg-web` is now built as the portable async target.

- **`@totemsdk/identity` 1.0.2 — explicit resolution time**
  - `resolveIdentityGraph(graph, { asOf })` evaluates claims only when `issuedAt <= asOf` and not expired at `asOf`.
  - `verifyManifestIdentity(..., { asOf })` rejects manifests signed after `asOf` or expired at `asOf`. Backward-compatible: omitting `asOf` uses `Date.now()`.

### Fixed

- **`@totemsdk/core-wasm` 1.0.4** — rebuilt the published `pkg`/`pkg-node`/`pkg-web` wasm with the pinned CI toolchain on Linux/amd64. No functional changes; main and npm now carry byte-identical artifacts.

- **`scripts/workspace-gates.config.json`** — removed stale `pureminima-rpc` entry (package removed in `9440d2b`); workspace gates now pass 58/58.

- **`@totemsdk/omnia` 2.3.0** — keep one live transport per peer (duplicate inbound sockets are destroyed instead of rebinding the active stream); single-dial rendezvous removes dual-socket churn; `requestPeerReply` resends the same proposal/nonce after a reconnect; `ReplyCache` makes factory/VC proposal handling idempotent and returns the identical reply to duplicates without consuming an extra WOTS leaf; DHT bootstrap entries are normalised and the announce address is pinned when host/port are explicit; `VC_ACCEPT` replies are no longer misread as proposals.

- **`@totemsdk/omnia-vtxo` 0.6.1** — pin the exit clock (`SAMESTATE(102)`) before the exit branch (P0), so the exit path cannot use a moved clock.

- **`@totemsdk/omnia-pool` 0.5.2** — `@totemsdk/omnia-factory`, `omnia-router`, `omnia-splice`, and `omnia-vtxo` are declared runtime dependencies (they are statically imported by `live-ports.ts`); optional peers made the published package unimportable in a clean install.

- **`@totemsdk/connect` 2.4.1** — refreshed workspace peer ranges so a flat install no longer hits `ERESOLVE` against the current Omnia family.

- **`@totemsdk/connect` 2.4.2** — refreshed the `omnia-factory` and `omnia-router` dependency ranges for the 0.7.0 / 0.4.0 releases (`^0.6.0`/`^0.3.0` excluded them).

- **`@totemsdk/omnia-pool` 0.5.3** — refreshed the `omnia-factory` and `omnia-router` ranges for the 0.7.0 / 0.4.0 releases.

- **`@totemsdk/stream-transport` 0.2.1** — `NodeStreamTransport` now waits for a raw stream's `opened`/`connecting`/`open`/`connect`/`ready` signal before sending, so writes to a `dht.connect()` stream are not lost during the Noise handshake.

- **`@totemsdk/tx-builder`** — `wasm-bridge.ts` uses a non-literal dynamic import so a fresh checkout typechecks and builds without generated `rust/pkg` output. `build:wasm` still produces the published artifacts; the runtime fallback is unchanged.

## [1.0.0] - 2026-08-20

### Added

- **`@totemsdk/core-wasm` 1.0.0** — Rust/WASM cryptographic core reaches v1 (WOTS, SHA3-256, TreeKey, TxPoW mining, BIP39).
- **`@totemsdk/kissvm` 1.0.0** — KISSVM evaluator reaches v1 (Rust/WASM-backed, Java byte-exact parity).
- **`@totemsdk/wots-lease` 1.0.0** — WOTS key-use coordination reaches v1 with all five provider layers implemented:
  - Layer 4 `P2PQuorumLeaseProvider` — multi-device quorum attestation over the same signing slot; slots are burned on quorum failure or conflict so they are never reused.
  - Layer 5 `OnchainWatermarkProvider` — on-chain watermark anchoring via a dedicated watermark coin whose STATE(0) holds the flat cursor.
  - `LocalLeaseProvider.reserveSpecificKeyUse` / `advanceToRemoteWatermark` / `listTrees` / `getJournal`.
  - New errors: `QuorumUnavailableError`, `QuorumConflictError`, `OnchainWatermarkError`, `IndicesUnavailableError`.
- **`@totemsdk/omnia` 1.0.0** — eltoo payment channels reach v1 (186 TS tests, 27 Rust tests, 11 WASM-parity suites, 8 built-in programs).
- **`@totemsdk/core` 1.2.9** — republished against `@totemsdk/core-wasm@^1.0.0`.

### Fixed

- **Stale compiled artifacts removed from `packages/core/src`** — 56 committed `.js`/`.d.ts` files that shadowed the TypeScript sources under jest's default module resolution, breaking `@totemsdk/tx-builder`'s ts-jest tests.
- **`@totemsdk/tx-builder` promoted to publishable** (0.1.9) — tests now run against the TS sources.
- **`@totemsdk/se-server` promoted to publishable** (0.1.3) — 24 new tests covering WOTS sign/verify, reclaim-TX encryption, config validation, and the full HTTP router flow.
- **`@totemsdk/lookup-protocol` 0.1.6** — `LEASE_RESERVE` accepts explicit indices for quorum attestation.
- **`@totemsdk/lookup-node` 0.1.9** — `LeaseCoordinator` honours explicit indices.
- **`@totemsdk/lookup-client` 0.1.7** — `leaseReserve` / `leaseCommit` / `leaseBurn` wire methods.

## [2.2.0] - 2026-03-08

### Added

- **`HierarchicalWitnessBundle` now a first-class export**
  - Exported from `@totemsdk/core/tx` and the root `@totemsdk/core` barrel
  - Replaces the deprecated flat `WitnessBundle` type; `WitnessBundle` alias retained for backward compatibility

- **Private project support in `AxiaRpcClient`**
  - New `projectSecret?: string` field in `AxiaClientConfig`
  - `x-axia-project-secret` header now sent on all `call()` requests and `getWatermark()` when a secret is configured
  - Enables use of private Axia projects from Node.js SDK consumers

### Fixed

- **`leaseTTL` double-multiplication bug** — `TransactionLifecycle` was computing `expiresAt = Date.now() + (leaseTTL * 1000)` but the backend sends `leaseTTL` already in milliseconds. Fixed to `Date.now() + leaseTTL`. A 5-minute lease was incorrectly stored as expiring in ~83 hours, preventing lease expiry checks from ever firing.

- **`TransactionService` endpoint URLs corrected** — all three endpoints updated to the live path prefix:
  - `/prepare` → `/v1/wots-hardened/prepare`
  - `/finalize` → `/v1/wots-hardened/finalize`
  - Watermark → `/v1/wots-hardened/watermark`

- **`addressIndex` now required in `/prepare` request body** — the backend validates this field (0–63) and uses it to allocate the signing indices for the correct address. `TransactionService.prepare()` now throws early if `params.addressIndex` is missing or out of range.

- **`paramSet` default corrected** — changed from `'minima'` to `'v2-spec'` to match the backend's accepted value.

- **Structured 429 handling in `TransactionService.prepare()`** — a 429 response now throws with `.code = 429`, `.limit`, `.used`, `.retryAfter` instead of an opaque HTTP error.

- **`TransactionService.sign()` rewritten to use per-address TreeKey architecture** — replaced the old flat signing model (which required injected `deps.wotsSign`) with direct use of `createPerAddressTreeKey(seed, addressIndex)` → `setUses(l1*64+l2)` → `sign(digestBytes)`. Produces 3 Java-compatible proofs (Root→L1→L2→DATA) exactly matching the Totem extension and Minima `Wallet.java`.

### Changed

- **`WotsSigningDependencies` deprecated** — the `deps` argument to `TransactionService.sign()` is now ignored (`_deps`). The function derives all signing material internally from `seed` and indices. The interface type is kept for backward compatibility and will be removed in v3.0.

- **`hardened-flow.ts` deleted** — the stale placeholder file containing `"0x<fill-with-real-signature>"` stub output has been removed. It was not exported from the package.

---

## [2.1.0] - 2026-02-09

### Added

- **ESM-First Module System**
  - Migrated `@totemsdk/core` to ESM (`"type": "module"`, `"module": "nodenext"` in tsconfig)
  - All relative imports now use `.js` extensions for ESM compatibility
  - Removed invalid CJS `require` entries from package.json exports map
  - Vite and other modern bundlers now resolve the SDK without workarounds

- **High-Level Verification API (`verify.ts`)**
  - `verifySignature(address, message, signatureHex, publicKeyHex): boolean` — one-liner signature verification for integrators
  - `verifySignatureDetailed(address, message, signatureHex, publicKeyHex): { valid, error? }` — same with descriptive error messages for debugging
  - `deriveAddressFromPublicKey(publicKeyHex): string` — server-side address/pubkey validation to prevent address-spoofing
  - `verifyTreeSignatureDetailed(data, signature, expectedRootPk): { valid, error? }` — low-level TreeSignature verification with error reporting
  - `normalizeHex(hex): string` — strips `0x` prefix and lowercases for defensive hex handling
  - `createChallenge(domain, nonce?): string` — generates time-limited JSON challenge string for replay protection
  - `validateChallenge(challenge, options?): VerificationResult` — validates challenge freshness, domain, and format

- **@totem/connect Client-Side Package**
  - New package at `packages/connect/`
  - Typed TypeScript wrappers: `connect()`, `requestSignature()`, `getAccounts()`, `sendTransaction()`
  - Event listener helpers: `onAccountsChanged()`, `onConnect()`, `onDisconnect()`
  - `isTotemInstalled()` detection and `getProvider()` access
  - Custom error classes: `TotemNotInstalledError`, `TotemConnectionError`
  - Full TypeScript declarations for the Totem provider API

- **WOTS Test Vectors**
  - Generated test vectors in `packages/core/test-vectors.json`
  - 2 passing + 1 intentionally-failing case for integrator validation
  - Exportable via `@totemsdk/core/test-vectors.json` package export

- **Integration Guide Documentation**
  - Comprehensive guide at `packages/core/docs/INTEGRATION_GUIDE.md`
  - Server-side verification walkthrough with full auth round-trip example
  - Hex encoding conventions (no `0x` prefix in Minima)
  - TreeSignature format specification (structure, WOTS count, serialization)
  - Session/nonce replay-protection guidance with `createChallenge`/`validateChallenge` pattern

- **npm Publish Readiness**
  - All packages (`sdk-core`, `sdk-node`, `connect`) have `publishConfig`, `prepublishOnly` scripts, and proper exports maps
  - `engines` field specifying Node.js >=16

### Changed

- **Unified Crypto Dependency**
  - Replaced `js-sha3` with `@noble/hashes/sha3` across all source files (`mmr.js`, `minima32.ts`, and pre-compiled `.js` counterparts)
  - `@noble/hashes` is now a `peerDependency` (>=1.3.0) in both `sdk-core` and `sdk-node`, giving consumers control over their version
  - Single crypto dependency tree reduces bundle size and eliminates version conflicts

### Fixed

- `normalizeHex()` now lowercases output to match documented behavior
- Removed redundant `new Uint8Array()` wrapping in `minima32.js` checksum computation

---

## [2.0.1] - 2026-02-05

### Added

- **Per-Address TreeKey Architecture**
  - Each address now has its own independent TreeKey (size=64, depth=3), matching Minima `Wallet.java` exactly
  - `derivePerAddressSeed(baseSeed, addressIndex)` using `hashObjects(baseSeed, MiniData(BigInteger(index)))`
  - Address public key derived from TreeKey MMR root (not a child node)
  - Signature capacity: 64 addresses x 4,096 signatures each = 262,144 total one-time signatures

- **Java Parity Tests**
  - 29 parity tests verifying byte-exact compatibility with Minima Java implementation
  - Test vectors for key generation, signature creation, and address derivation
  - Reference Java test files for cross-implementation validation

- **Complete CoinProof Extraction**
  - `extractCoinDataFromCoinProof()` extracts ALL coin fields from CoinProof with pre-serialized bytes
  - Includes `rawMmrEntryBytes`, `rawBlockCreatedBytes`, `RawStateVariable[]` for byte-exact serialization
  - Fixes transaction ID mismatch caused by hardcoded defaults (mmrEntryNumber=0, blockCreated=0)

- **Seed Fingerprint Verification**
  - Wallet creation now verifies seed fingerprint for security

### Changed

- **Per-Address Signing Flow**
  - Signing now uses `setUses(l1*64+l2)` + `sign(data)` producing 3 proofs (Root→L1→L2→DATA)
  - Matches Java's `TreeKey.sign()` exactly
  - Index mapping: Legacy (l1, l2, l3) → Per-address (addressIndex=l1, l1=l2, l2=l3)

- **WatermarkStore v2**
  - Per-address tracking with `(addressIndex, l1, l2)` tuples
  - Legacy format detection triggers automatic migration

- **LeaseStore**
  - Updated for `SigningIndices` with `(addressIndex, l1, l2)` tuples

### Fixed

- **Critical Double-Hashing Bug** — WOTS verification was double-hashing messages; removed redundant hash to match Java/BouncyCastle behavior
- **WOTS Internal Hashing** — Corrected hash chain computation for parity with Java `WinternitzOTSignature`
- **Public Key Digest** — Fixed WOTS public key digest computation
- **Signature Proof Serialization** — Corrected field ordering to match Minima's expected format

### Removed

- **Legacy Flat Architecture** — All legacy flat architecture code paths removed from transaction signing (`treeIndex = l1*64*64 + l2*64 + l3`, `fullPublicKey`, `treePkdigest`)
- Deprecated placeholder files (`encode.deprecated.ts`, `serialize.deprecated.ts`) quarantined

---

## [2.0.0] - 2026-01-18

### Added

- **Canonical Serialization Architecture**
  - `Streamable.ts` as the single source of truth for byte-exact Java-compatible serialization
  - Uses `bigint` for precision in all numeric serialization
  - `javaStreamables.ts` wrappers for backward compatibility
  - `writeMiniData`, `writeMiniNumber`, `writeMiniString`, `writeMiniInteger` primitives

- **MEG Balance Streaming Background Integration**
  - Wired `MegBalanceStreamManager` to background service worker via dedicated `balance-stream` port handler
  - Implemented port message protocol: `START_STREAM`, `STOP_STREAM`, `UPDATE_ADDRESSES`, `GET_CACHED`
  - Event forwarding: `BALANCE_UPDATE`, `TX_CONFIRMATION`, `CONNECTION_STATE`
  - Proper cleanup on port disconnect to prevent memory leaks
  - Balance streaming works independently of SDK migration flag (`initMode`)

### Documentation

- Updated RFC-001-SDK-UPGRADE.md with Section 3.3: MV3 Background Integration
- Added Balance Streaming Integration section to SDK_ROLLBACK_RUNBOOK.md
- Updated docs/developers/extension/websocket-lifecycle.md

---

## [1.0.0] - 2025-11-26

### Added

- SDK Upgrade Initiative (RFC-001) implementation complete
- Feature flag infrastructure with `walletInitMode` and `SdkMigrationManager`
- Auto-rollback mechanism (3 errors/hour, 24h cooldown)
- Canary rollout support (10% bucket assignment via extension ID hash)
- Extracted `LeaseStore`, `WatermarkStore`, `LeaseMonitor` with adapter-driven architecture
- Platform-agnostic adapter interfaces: `StorageAdapter`, `AuthTokenProvider`, `WebSocketFactory`, `TimerAdapter`, `LoggerAdapter`, `MetricsAdapter`
- 69 parity tests validating SDK vs legacy output equivalence
- 37 chaos tests for graceful degradation scenarios
- Playwright E2E tests for staged rollout
- Node.js wallet example in `examples/node-wallet/`

### Documentation

- RFC-001-SDK-UPGRADE.md: Complete SDK upgrade specification
- SDK_AUDIT.md: Existing package reconciliation plan
- SDK_ROLLBACK_RUNBOOK.md: Three-tier rollback procedures
- Staged rollout guide with canary progression
- Recovery CLI reference
