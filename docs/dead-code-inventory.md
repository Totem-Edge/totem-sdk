# Dead Code & Placeholder Inventory — Monorepo-Wide Scan

> Systematic scan of all 12 remaining packages for on-chain/off-chain KISSVM placeholders, dead type fields, unimplemented status transitions, forward-looking stubs, and TTL/expiry/block-height fields defined but never enforced.

---

## Scan Results Summary

| Package | Source | Dead Fields | Forward Placeholders | Not-Impl Functions | kissvm Keyword Dead | Enforceable TTL/Block Fields | Severity |
|---|---|---|---|---|---|---|---|
| agent-policy       | 33 files   | 18 | 2 | 1 | 1 | 2 | **High** |
| authority          | 8 files    | 5  | 6 | 2 | 0 | 2 | **High** |
| chain-provider     | 6 files    | 15 | 0 | 0 | 1 | 0 | Low |
| core-wasm          | 28 files   | 1  | 4 | 15 | 1 | 0 | **Medium** |
| identity           | 14 files   | 7  | 1 | 0 | 1 | 0 | Low |
| lookup-protocol    | 7 files    | 30+ | 4 | 0 | 1 | 7 | **High** |
| manifest           | 8 files    | 39 | 0 | 0 | 1 | 3 | **High** |
| proof              | 10 files   | 8  | 1 | 0 | 1 | 0 | **Medium** |
| pubsub-transport   | 1 file     | 0  | 2 | 0 | 1 | 0 | Low |
| stream-transport   | 1 file     | 3  | 0 | 0 | 1 | 0 | Low |
| txpow              | 10 files   | 9  | 8 | 1 | 1 | 0 | **Medium** |
| wots-lease         | 12 files   | 10 | 4 | 13 | 1 | 1 | **High** |

**TOTALS:** 145+ dead/placeholder items across 138 source files. 53 enforceable TTL/block-height fields identified as candidates for temporal template integration.

---

## 1. `@totemsdk/agent-policy` — 24 findings

### Pattern: Forward-looking types with zero enforcement
The entire `PaymentIntent` is declared with 6 fields but only `risk: number` is ever evaluated. `AgentPolicyConfig.expiresAt` is defined in protobuf but never checked.

| Location | Line(s) | Dead Item | Category |
|---|---|---|---|
| `src/types.ts` | 5-6 | Stale roadmap comment (`Phase 1.5`/`Phase 2`) | Future reference |
| `src/types.ts` | 21,23,25,27,31 | `PaymentIntent.amount`, `tokenId`, `recipient`, `reason`, `metadata` — never read by `RiskBasedPolicy` | Unreferenced fields |
| `src/types.ts` | 51,53 | `AgentProposal.confidence`, `createdAt` — never read by `RiskBasedPolicy` | Unreferenced fields |
| `src/types.ts` | 88 | Status union `approved|rejected|pending_user` — no transition logic exists | Unimplemented state machine |
| `src/types.ts` | 90,92,94,96 | `AgentReceipt.txpowId`, `channelState`, `rejectionReason`, `settledAt` — never consumed | Unreferenced fields |
| `src/index.ts` | 37-42 | Proto type aliases never referenced (`ProtoPaymentIntent`, `ProtoAgentProposal`, etc.) | Dead re-exports |
| `proto/agent_policy.proto` | 89-94 | `AgentPolicyConfig` message entirely unused | Dead message |
| `proto/agent_policy.proto` | 93 | `AgentPolicyConfig.expires_at` — TTL field, no enforcement | TTL dead |
| `package.json` | 64 | `kissvm` keyword, zero usage | Keyword dead |

**Temporal activation path:** `expiresAt` → temporal deadline; `amount`+`risk` → temporal linear for pay-per-use; `metadata` → temporal window for context-based pricing.

---

## 2. `@totemsdk/authority` — 15 findings

### Pattern: Forward-looking crypto fields stripped from hashing
`ActionIntent.nonce` exists as a replay-protection field but is explicitly destructured-and-discarded in ID computation. `MandateBody.revocationEpoch` is set but never read back.

| Location | Line(s) | Dead Item | Category |
|---|---|---|---|
| `src/types.ts` | 9 | `ActionIntent.nonce` — stripped from ID (ids.ts:15) | Future placeholder |
| `src/types.ts` | 21 | `MandateBody.revocationEpoch` — set at mandate.ts:36, never read | TTL dead |
| `src/types.ts` | 48-49 | `AuthorityUsageSnapshot.windowEnd` — computed (usage.ts:76) but never consumed (usage.ts:15 recomputes it) | Unreferenced field |
| `src/types.ts` | 54 | `MandateStatusSnapshot.currentEpoch` — never read anywhere | Unreferenced field |
| `src/types.ts` | 66-67 | `MandateVerificationResult.scopeMatch` (always true), `usageExceeded` (always false) — never reflect real values | Dead assignments |
| `src/mandate.ts` | 103-104,185 | `scopeMatch: false` initialized then unconditionally set to `true` | Unimplemented logic |
| `src/evaluate.ts` | 21 | `evidence?: SignedProof[]` — accepted but never cryptographically verified | Future placeholder |
| `src/usage.ts` | 67 | `now: number` param accepted by `snapshotFromUsage` but never consumed | Temporal injection dead |
| `docs/governance-design.md` | 336 | `direct KISSVM/UTXO constitutional enforcement` mentioned as future | kissvm future reference |

**Temporal activation path:** `revocationEpoch` → temporal cliff (mandate immutable until epoch); `nonce` → temporal rate-limit (max N actions per block); `windowEnd` → temporal window; `evidence` → temporal deadline for proof submission.

---

## 3. `@totemsdk/chain-provider` — 3 findings (Low)

### Pattern: Pass-through API fields never consumed internally
The `Coin` interface mirrors 6 Minima API fields that are stored but never read by business logic. Cleanest package in the scan.

| Location | Line(s) | Dead Item | Category |
|---|---|---|---|
| `package.json` | 60 | `kissvm` keyword, zero usage | Keyword dead |
| `package.json` | 26 | `@totemsdk/core` dependency, never imported | Dead dependency |
| `src/types.ts` | 52 | `TokenSearchQuery.category` — never read by any provider | Unreferenced field |

---

## 4. `@totemsdk/core-wasm` — 17 findings (Medium)

### Pattern: 15 uncalled public Rust functions
Serialization helpers and utilities were written speculatively but never bound to WASM or called from production code.

| Location | Line(s) | Dead Item | Category |
|---|---|---|---|
| `package.json` | 46 | `kissvm` keyword, only in Rust comments describing script format | Keyword dead |
| `src/params.rs` | 33 | `NETWORK_ID` — defined, exported, never referenced | Unreferenced constant |
| `src/streamable.rs` | 46,62,80,90,105 | 5 serialization helpers (`write_mini_byte`, `write_state_variable`, `write_mmr_proof`, `write_signature`, `write_hierarchical_witness`) — never called | Uncalled functions |
| `src/utils.rs` | 25,30,35 | `utf8_to_bytes`, `bytes_to_utf8`, `zero_bytes` — never called | Uncalled functions |
| `src/wots.rs` | 343-345 | `wots_public_key_from_seed` — alias for `derive_pk_digest`, never called | Uncalled function |
| `src/verify.rs` | 31-54,176-185 | `verify_signature`, `derive_address_from_public_key` — never called | Uncalled functions |
| `src/derive.rs` | 20 | `address_to_root` — never called | Uncalled function |
| `src/java_streamables.rs` | 46 | `derive_child_tree_seed_java` — duplicates `derive_chain_seed_java`, never called | Dead function |
| `src/treekey.rs` | 358-361 | `create_per_address_tree_key` — factory function never bound to WASM | Uncalled function |
| `src/mmr.rs` | 266 | `parse_mmr_proof_from_hex` — never called | Uncalled function |

**Temporal activation path:** `write_state_variable` and `write_mmr_proof` are the exact serializers needed for temporal template state variable encoding. These functions are already written but detached.

---

## 5. `@totemsdk/identity` — 9 findings (Low)

### Pattern: `IdentityVerifyResult` fields never populated
Three fields (`rootAddress`, `provenAddresses`, `metadata`) are declared in the result interface but none of 6 return paths in `verify.ts` ever set them.

| Location | Line(s) | Dead Item | Category |
|---|---|---|---|
| `src/types.ts` | 62-64 | `IdentityVerifyResult.rootAddress`, `provenAddresses`, `metadata` — declared but never populated by `verify.ts` | Unreferenced fields |
| `src/types.ts` | 68 | `IdentityProofVerifier.type` — declared but never read | Unreferenced field |
| `src/types.ts` | 12-15 | `IdentityKind: 'organization'|'sensor'|'robot'|'gateway'` — declared but never used | Dead union members |
| `src/signing.ts` | 35-42 | `proof.message` — never set on sign output | Unreferenced field |
| `src/guards.ts` | 54-75 | `isRotationClaim`, `isRevocationClaim` — exported but never tested | Untested functions |
| `package.json` | 64 | `kissvm` keyword, zero usage | Keyword dead |

---

## 6. `@totemsdk/lookup-protocol` — 42+ findings (High)

### Pattern: 44 message types with zero pattern-matching
The `MessageType` union defines 44 string literals but no `switch`/`case` or exhaustive match exists anywhere. Every message is handled via generic `JSON.stringify`/`JSON.parse`. 7 `expiresAt` fields across different messages — none enforced.

| Location | Line(s) | Dead Item | Category |
|---|---|---|---|
| `src/messages.ts` | 12-56 | `MessageType` — 44 literals, zero matched in any switch/case | Dead union (entire) |
| `src/messages.ts` | 77,153,171,212,255,400,433 | `expiresAt` / `block` / `ttlMs` across 7 message payloads — never enforced | TTL dead (7x) |
| `src/messages.ts` | 61,69,94,110,111 | 5 fields on `BaseMessage`, `HelloMessage`, `WatchRegisterMessage`, `GetCoinsMessage` — never read | Unreferenced fields (5x) |
| `src/messages.ts` | 153,151 | `CoinUpdateMessage.block` (block-height) and `eventType` — never matched | Dead values |
| `src/messages.ts` | 169-173,180-181,189-190,199-203 | 14 fields on Lease message payloads — never read by name | Unreferenced fields (14x) |
| `src/messages.ts` | 231-236,261-265,272-277,296,306 | 14 fields on App/Agent/Trust messages — never consumed | Unreferenced fields (14x) |
| `src/messages.ts` | 401-404,411-419,433,450,477-480 | 12 fields on Policy messages — never consumed | Unreferenced fields (12x) |
| `package.json` | 59 | `kissvm` keyword, zero usage | Keyword dead |
| `src/auth.ts` | 7 | `ed25519 signing is intentionally deferred` | Future work |
| `src/framing.ts` | 9-10 | `Upgrade to msgpack can happen by bumping PROTOCOL_VERSION` | Future work |

**Temporal activation path:** 7 `expiresAt` fields → temporal deadline; `block` on `CoinUpdateMessage` → temporal window; `ttlMs` on lease → temporal cliff; `eventType` → temporal state machine (new→spent→confirmed).

---

## 7. `@totemsdk/manifest` — 44 findings (High)

### Pattern: 39 type fields never consumed by business logic
`AppManifest` has 15 fields but only 3 are read by `verifyManifest`. `EdgeServiceManifest` has 13 fields, only 3 consumed. `signedAt` is written via `Date.now()` but never validated.

| Location | Line(s) | Dead Item | Category |
|---|---|---|---|
| `src/types.ts` | 24-37 | `AppManifest`: `appId`, `name`, `version`, `price`, `priceToken`, `subscriptionInterval`, `category`, `permissions`, `iconCid`, `description`, `repoUrl`, `minTotemVersion` — never consumed | Unreferenced fields (12x) |
| `src/types.ts` | 42-55 | `CapabilityManifest`: 10 of 13 fields never consumed | Unreferenced fields (10x) |
| `src/types.ts` | 66-77 | `DAppManifest`: 7 of 10 fields never consumed | Unreferenced fields (7x) |
| `src/types.ts` | 94-110 | `EdgeServiceManifest`: 9 of 13 fields never consumed | Unreferenced fields (9x) |
| `src/types.ts` | 54,109 | `expiresAt` on CapabilityManifest (required) and EdgeServiceManifest (optional) — never enforced | TTL dead (2x) |
| `src/types.ts` | 131,60 | `signedAt` written via `Date.now()` (sign.ts:60) but never validated by `verifyManifest` | Temporal dead |
| `src/types.ts` | 14-20 | 7 `AppPermission` values including `'kissvm:evaluate'` — never checked or enforced | Dead permissions |
| `src/types.ts` | 133 | `SignedManifest.rootIdentityProof` — never set or read | Unreferenced field |
| `package.json` | 62 | `kissvm` keyword, zero enforcement code | Keyword dead |

**Temporal activation path:** `expiresAt` → temporal deadline (2x); `signedAt` → temporal window (prove manifest was signed within valid block range); `subscriptionInterval` → temporal rate-limit; `maxCallsPerMinute` → temporal rate-limit.

---

## 8. `@totemsdk/proof` — 11 findings (Medium)

### Pattern: Entire `ProofProvider` interface is dead
`ProofProvider` defines 6 optional methods for anchoring/hashing but nothing implements or consumes it. `ProofKind` declares 3 unused values.

| Location | Line(s) | Dead Item | Category |
|---|---|---|---|
| `package.json` | 64 | `kissvm` keyword, zero usage | Keyword dead |
| `src/index.ts` | 8-10 | `bridged into EdgeProofPort in a future @totemsdk/edge update` | Future reference |
| `src/index.ts` | 22-24 | Dead type re-exports: `ProofOperationResult`, `ProofProviderCapability`, `ProofProvider` | Dead re-exports |
| `src/types.ts` | 21-23 | `ProofKind: 'capability'|'revocation'|'delegation'` — declared but never used by any function | Dead union members |
| `src/types.ts` | 46 | `AnchorRef.confirmedAt` — declared but never set by `attachAnchor` | Unreferenced field |
| `src/types.ts` | 82 | `SignedProof.rootIdentityProof` — declared but never populated by any function | Unreferenced field |
| `src/types.ts` | 92-115 | `ProofOperationResult` (entire interface), `ProofProviderCapability` (entire type), `ProofProvider` (entire interface) — no implementation exists | Three entirely dead types |
| `src/proof.ts` | 113-150 | `signWithLease` — public API exported but untested | Untested function |

**Temporal activation path:** `confirmedAt` → temporal deadline (proof must be confirmed within N blocks); `ProofProvider.anchorProof` → temporal anchor stamp; `expiresAt` (on proof fields) → temporal window.

---

## 9. `@totemsdk/pubsub-transport` — 5 findings (Low)

### Pattern: Single clean file, no substantive dead code
Smallest in the scan. `kissvm` keyword in `package.json` is the only notable finding.

| Location | Line(s) | Dead Item | Category |
|---|---|---|---|
| `package.json` | 56 | `kissvm` keyword, zero usage | Keyword dead |
| `src/index.ts` | 77-79 | `EventEmitterTransport.connect()` is empty/no-op | Empty function body |
| `src/index.ts` | 48,51 | `MqttClientPort` and `MqttMessage` backward-compat type aliases — unreferenced internally | Dead aliases |
| `tsconfig.json` | 23-24 | `**/*.test.ts` exclusion for test files that don't exist | Forward placeholder |
| `package.json` | 18 | `"test": "jest --passWithNoTests"` | Forward placeholder |

---

## 10. `@totemsdk/stream-transport` — 3 findings (Low)

| Location | Line(s) | Dead Item | Category |
|---|---|---|---|
| `package.json` | 66 | `kissvm` keyword, zero usage | Keyword dead |
| `src/index.ts` | 95 | `WebSocketTransport._ws.readyState` — declared but never read or checked | Unreferenced field |
| `src/index.ts` | 256-257 | `HyperswarmStreamTransport.pubkey`, `topics` — assigned in constructor but never read internally | Unreferenced fields |

---

## 11. `@totemsdk/txpow` — 19 findings (Medium)

### Pattern: 8 forward-looking comments referencing Task #114/#130
Magic struct fields are write-only constants. 3 TxBody fields are always serialized as empty/zero. One dead `hexToBytes()` in test file.

| Location | Line(s) | Dead Item | Category |
|---|---|---|---|
| `package.json` | 62 | `kissvm` keyword, zero usage | Keyword dead |
| `src/magic.ts` | 9,14-18,27,32 | `maxTxPoWSize`, `maxKISSVMOps`, `maxTxnPerBlock`, `minTxPoWWork` — write-only constants, never read back | Write-only fields (4x) |
| `src/mine.ts` | 20,517 | `Task #114` references (stale — worker exists) | Stale comments |
| `src/mine-wasm.ts` | 14,53,107,151 | `Task #114` / `future` references | Forward references (4x) |
| `src/browser.worker.ts` | 6 | `Task #114` reference | Forward reference |
| `src/serialization.ts` | 29-30,33,43-45 | `mBlockNumber`, `mMMRTotal`, `mBurnTransaction`, `mBurnWitness`, `mTxPowIDList` — always 0/empty | Dead fields (5x) |
| `src/constants.ts` | 5-6,10 | `MAX_HASH`, `CASCADE_LEVELS` — written but never validated | Unenforced constants |
| `src/__tests__/serialization.test.ts` | 9,34-38 | `Task #130` reference + `hexToBytes()` dead function | Forward ref + dead code |
| `src/magic.ts` | 17 | `placeholder in fresh TxPoW` | Forward placeholder |

---

## 12. `@totemsdk/wots-lease` — 33 findings (High)

### Pattern: 13 "not implemented" functions across 2 provider stubs
`P2PQuorumLeaseProvider` and `OnchainWatermarkProvider` each throw `NotImplementedError` for all 7 methods. `LeaseCertificate` has 6 fields carried but never cryptographically verified.

| Location | Line(s) | Dead Item | Category |
|---|---|---|---|
| `package.json` | 63 | `kissvm` keyword, zero usage | Keyword dead |
| `src/types.ts` | 13 | `LeaseStatus: 'pending'` — never set by any code path | Dead status value |
| `src/types.ts` | 34-43 | `LeaseCertificate.branchId`, `deviceId`, `indices`, `purpose`, `payloadHash`, `issuedAt`, `signature` — never verified | Unreferenced fields (6x) |
| `src/types.ts` | 50 | `LeaseReservation.leaseToken` — set but never read | Unreferenced field |
| `src/types.ts` | 83 | `SyncResult.advancedTo` — never populated or consumed | Unreferenced field |
| `src/stubs.ts` | 141-163 | `P2PQuorumLeaseProvider` — all 7 methods throw `NotImplementedError` | Not implemented (7x) |
| `src/stubs.ts` | 166-188 | `OnchainWatermarkProvider` — all 7 methods throw `NotImplementedError` | Not implemented (7x) |
| `src/local.ts` | 204-206,208-211,213-216 | `publishWatermark`, `syncLeaseJournal`, `verifyLeaseCertificate` — no-op stubs | Empty functions (3x) |
| `src/axia.ts` | 158-160,162-164,166-169 | `publishWatermark`, `syncLeaseJournal`, `verifyLeaseCertificate` — no-op stubs | Empty functions (3x) |
| `src/hybrid.ts` | 18-19 | P2P and Onchain provider types imported but never functionally used | Unused imports |
| `src/errors.ts` | 32-44 | `P2PQuorumNotImplementedError`, `OnchainWatermarkNotImplementedError` — both classes only thrown by stubs | Error classes for future use |

**Temporal activation path:** `LeaseCertificate.expiresAt` → temporal deadline; TTL stored on lease → temporal cliff enforcement; `SyncResult.advancedTo` → temporal linear (advance watermark at block intervals); `pending` status → temporal window (lease transitions pending→active at block N); P2P quorum → temporal deadline for multi-party lease verification.

---

## Cross-Cutting Synthesis

### Categories Ranked by Impact

| Category | Total Count | Most Affected Packages |
|---|---|---|
| Type fields never consumed | 100+ | manifest (39), lookup-protocol (30+), agent-policy (18) |
| TTL/expiry/block-height never enforced | 17 | lookup-protocol (7), manifest (3), agent-policy (2), authority (2) |
| "Not implemented" function bodies | 16 | wots-lease (13), agent-policy (1), core-wasm (15 uncalled + 0 not-impl) |
| Forward-looking placeholders | 32 | txpow (8), authority (6), lookup-protocol (4) |
| kissvm keyword dead in package.json | 12 of 12 | Every package had `"kissvm"` in keywords with zero source usage |
| Enum/union members never matched | 5+ | lookup-protocol (4 unions), proof (1 union) |
| Dead dependency | 1 | chain-provider: `@totemsdk/core` listed but never imported |

### Temporal Activation Candidates (53 total)

These are the fields that map most directly to the 6 temporal curves from the Temporal Script Framework:

| Temporal Curve | Applicable Dead Fields | Packages |
|---|---|---|
| **deadline** | `expiresAt` (9x), `confirmedAt`, `signedAt`, lease TTLs | lookup-protocol (7), manifest (2), wots-lease, proof, agent-policy |
| **cliff** | `unlockAfterBlock`, `revocationEpoch`, vesting lock terms | authority, liquidity-bond, provider-bond |
| **window** | `eventType: new→spent→confirmed`, trust windows, subscription intervals | lookup-protocol, manifest |
| **linear** | `SyncResult.advancedTo`, streaming payment accrual, fee pro-rata | wots-lease, liquidity-bond |
| **rate-limit** | `maxCallsPerMinute`, `nonce`, usage windows, `maxKISSVMOps` | authority, manifest, agent-policy, txpow |
| **decay** | Bond value decay, proof freshness, trust scoring | provider-bond, identity |

### `kissvm` Keyword Density

Every single package in the monorepo lists `"kissvm"` in its `package.json` keywords array. Zero packages (outside of `@totemsdk/kissvm` itself) use the VM in any source code. This is a copy-paste artifact from a common `package.json` template and should be removed from all 12 package.json files.

### Previously Scanned Packages (from temporal design work)

For completeness, these packages were scanned during the temporal framework design and have their own dead-code findings already documented:

| Package | Key Dead Items | Documentation |
|---|---|---|
| liquidity-bond | 7 dead type fields (`unlockAfterBlock`, `until-block`/`epoch`), 7 never-assigned statuses, `pro-rata` fee never computed | temporal-framework-design.md §2.6 |
| provider-bond | 5 dead placeholder types (`expiresAtBlock`, `future-l1-lock`, etc.), 0 slashing/release code | temporal-framework-design.md §2.7 |
| omnia-router | `Route.estimatedBlocks` informational only, `RouteOptions` only has `maxHops` | temporal-framework-design.md §2.8 |
| governance | `expired` proposal status never assigned, `issuedAt` ordering never validated | temporal-framework-design.md §2.3 |
| edge adapters ×11 | Zero kissvm references despite `package.json` keywords suggesting it | temporal-framework-design.md §2.1 |
