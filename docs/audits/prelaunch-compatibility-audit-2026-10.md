# Pre-launch compatibility and legacy-code audit (October 2026)

Status: **Audit — findings only.** No removal is authorised by this document.
Snapshot: 2026-10-20, `main` at `48fec3dc`.
Scope: all 60 `docs/rfc/RFC-*.md` files plus built code in `packages/`,
`extensions/`, `tools/`, `native/` and `scripts/`.

> **Premise.** If the SDK is pre-release and has no installed user base, then
> compatibility shims, deprecation windows, migration guides and dual code paths
> for SDK consumers are unjustified. This audit separates those decisions from
> compatibility that is required by persisted state, on-chain scripts or wire
> protocols, which must be preserved regardless of user count.

---

## 1. Verdict

The repository already states the pre-release position in several places:

- RFC-007 §1: “The SDK is **pre-release**: nothing in this RFC preserves
  backwards compatibility.”
- RFC-059: clean break, no shims, aliases, dual implementations or migration
  burden.
- RFC-060: “Prerelease, clean break. No migration, aliases or
  backward-compatibility shims.”

Despite that, a meaningful set of RFCs and shipped code assumes users that do not
exist. The largest clusters are:

1. the browser extension's SDK migration/rollout machinery (legacy mode,
   telemetry, canary, auto-rollback);
2. persisted extension storage migrations from older wallet formats;
3. the `@totemsdk/connect` dual method set (`TOTEM_*` + `totem_*`);
4. the `@totemsdk/core` alias/`/legacy` surface;
5. one-release aliases in `kissvm`/`tx-builder`;
6. the agent-policy dual interface and unauthenticated fallback.

**Recommendation:** adopt an explicit pre-1.0 compatibility policy, remove the
user-assumption shims, and keep only protocol/state compatibility. Then add a CI
guard so the policy cannot silently erode.

---

## 2. Classification

Every finding is classified as one of:

| Class | Meaning | Action |
|---|---|---|
| **U — user-assumption compatibility** | Exists so hypothetical external callers/users are not broken. | Remove pre-launch. |
| **S — state compatibility** | Persisted local state, channel snapshots, journals, watermarks. | Keep only if real deployed state exists; otherwise reset the format. |
| **P — protocol/on-chain compatibility** | Wire formats, scripts, on-chain state, mixed-version peers. | Keep. |
| **I — internal alias** | Type/re-export aliases inside the SDK. | Optional cleanup; low risk. |

The presence of `@deprecated`, `legacy`, `compat`, `migration`, `fallback`,
`shim`, dual dispatch or “existing callers” language was used to find candidates.
Comments were checked against code because several are stale (see §4.4).

---

## 3. RFC findings

### 3.1 High priority — assumes users

| RFC | Finding | Evidence | Recommendation |
|---|---|---|---|
| **RFC-001** (Draft) | “Maintain backward compatibility with existing SDK consumers,” “protect existing wallet initialization flow,” dual `legacy`/`sdk` init, `fallbackOnError`, canary rollout, telemetry, rollback, migration guide. | §2 Goals 4–5; §6; §9 Backward Compatibility | Pick one init path. Delete legacy mode, fallback, canary, telemetry and rollback. Mark the RFC historical/superseded. |
| **RFC-016** | Deprecated aliases and a deprecation window for renames and MAST roots. | §8 `Compatibility & migration` | Rename outright; delete aliases and the one-time migration utility. |
| **RFC-031** | `/legacy` JS kernels, `legacy*` aliases, deprecation window, “consumers,” migration/codemod. | §8–§9, §11 | Delete `/legacy` and aliases unless a real supported non-WASM target (RN/Hermes) requires a frozen shim. If it does, keep one target, drop the migration story. |
| **RFC-058 / RFC-061** | “Keep existing signing functions for compatibility,” migration path for “existing seed-based hosts,” deprecation of seed signing. | RFC-058 §11; RFC-061 custody boundary | Keep seed only as explicit self-custody; make hosted mode a clean break. Remove migration/deprecation for hypothetical hosted users. |
| **RFC-014-A** | Absent capability probe defaults to **supported** (“behaves as today”). | §5 lines 69/92/238 | Require explicit probes; absent should be unknown/unsupported. Verify the implementation before changing. |
| **RFC-019** | Preserve trusted-host `createEdge().buy()` and provide an agent migration path. | §8 Backward compatibility | Remove the agent-facing `buy()` path outright; no migration for nonexistent callers. |
| **RFC-009** | Flat `{ pubkeyHex, signature }` accepted “so existing callers keep working.” | §5 witness forms | Remove the flat form; require canonical `{ proofs }`. |
| **RFC-036** | Do not break `sendTransaction()`’s “existing callers”; settlement must remain opt-in. | §4.5, §5 | Change if it is an internal API; make settlement explicit. Verify callers first. |
| **RFC-004** | `pureminima-rpc` deprecation path, migration guide, delayed unpublish. | §4.2 | The package is already removed; delete the migration story and finish the unpublish. |
| **RFC-057** | “Keep all existing `@totemsdk/pear` subpath imports working,” compatibility fixture. | §7 Phase 0, §3 | Drop the compatibility requirement unless Pear has real users; design the clean API now. |
| **RFC-010** | Considered keeping `ActionRegistry`/`GovernanceBridge` as deprecated aliases. | Q3 | Landed as removal; confirm no aliases remain. |
| **RFC-002** | Legacy channel recovery defaults for `programId`/`programVersion`. | §7.1 | Keep only if persisted channels exist; otherwise remove. |

### 3.2 Medium priority — compatibility escape hatches

- **RFC-022 §6** — `confirmation` defaults to `'completed'` “preserving
  single-shot semantics.”
- **RFC-029 §6** — `allowSelectedProbabilityAsConfidence: true` restores
  pre-hardening behaviour; flat acceptance fields remain the default.
- **RFC-032-A** — ticketless mixed-version node compatibility; keep only if
  nodes are deployed.
- **RFC-023 / RFC-028 / RFC-030** — optional fields or “behaves as today”
  defaults. Mostly additive, but should be described as API evolution, not user
  compatibility.
- **RFC-012 / RFC-017 / RFC-021** — explicitly additive; fine, but the rationale
  should be “additive API,” not “existing users.”

### 3.3 Justified compatibility — keep

- **RFC-002** persisted channel snapshots (if any exist).
- **RFC-007** storage format refusal/migration for valuable local state; its
  pre-release statement is the correct model.
- **RFC-032/035/037/038/048/049/050/052/053/054/055** on-chain scripts, state
  machines and wire formats.
- **RFC-047** as-stored journal digests (evidence integrity).
- **RFC-058** manifest `custody` absence fails closed (security default).
- **RFC-059 / RFC-060** clean-break statements are the model to follow.

---

## 4. Built-code findings

### 4.1 Highest confidence — remove the compatibility layer

| Area | What exists | Evidence | Class |
|---|---|---|---|
| **Extension SDK rollout machinery** | `SdkInitMode = 'sdk' \| 'legacy' \| 'auto'`, rollout groups, telemetry, auto-rollback, cooldown, admin console. | `extensions/totem-extension/src/config/SdkMigrationManager.ts:16,68,111-115,220-245`; `SdkTelemetry.ts:217-271`; `core/features/FeatureFlags.ts:13,153-178,251-260`; `utils/sdk-rollout-admin.ts`; `background/index.ts:1059,5042-5087` | U |
| **Extension storage migrations** | Legacy watermark v1 detection and `migrateLegacy()`, legacy lease index remap, legacy flat witness bundles, legacy WOTS builder paths. | `core/stores/WatermarkStore.ts:58,72,81-89,166-248,526-534`; `core/stores/LeaseStore.ts:28,82-92`; `core/transaction/service.ts:58,111`; `core/transaction/MinimaTransactionBuilder.ts:1529-1576,1809,1879`; `core/transaction/services/ProofFetcher.ts:243` | S/U |
| **Extension API shims** | `getApiKey()` kept “for backward compatibility,” legacy `request()` wrapper, legacy handler bridge. | `core/api/base.ts:20-26`; `rpc/enhanced-provider.ts:290-305`; `core/connect/walletRuntime.ts:6-11,79` | U |
| **Connect dual method set** | Uppercase `LEGACY_METHODS` (`TOTEM_*`) served alongside lowercase `TOTEM_METHODS` (`totem_*`). | `packages/connect/src/wallet.ts:28-86` | U |
| **`@totemsdk/core` aliases** | `/legacy` surface, `legacy*` exports, legacy param/address/WOTS/treekey/MMR wrappers. | `core/src/legacy.ts`; `core/package.json` `./legacy`; `core/src/params.ts:38`; `minima32.ts:95,120-126`; `wots.ts:319,325,599,638-641,504`; `treekey.ts:994,1007-1008`; `mmr.ts:461`; `javaStreamables.ts:12,27,40,212`; `minimaWireSerializer.ts:7`; `tx/TransactionService.ts:34-36`; `tx/types.ts:74`; `index.ts:291,306` | U/I |
| **KISSVM / tx-builder aliases** | `buildTxPoWValidationScript` → `buildAttestedTxPoWMetaScript`, `DeepFundingProof` → `SignedFundingIntent`, deprecated proof helpers, flat witness form. | `kissvm/src/templates/txpow.ts:42-43`; `kissvm/src/index.ts:267`; `tx-builder/src/fund-tx.ts:82-83`; `kissvm/src/mast/proof-chain.ts:197,205`; `kissvm/src/witness.ts:8,13,52` | U |
| **WOTS lease journal migration** | Legacy whole-array journal key, divergence checks, replay into v1 layout. | `wots-lease/src/journal.ts:4,16,239-267` | S |
| **Agent-policy dual interface** | Legacy `AgentPolicy` (`canAutoApprove`/`requiresUserApproval`), `agentId` fallback for unauthenticated callers, string-union types. | `agent-policy/src/composable.ts:10`; `rate-limit.ts:56`; `amount-cap.ts:66`; `index.ts:23`; `edge-adapters/src/policy.ts:79` | U |

### 4.2 Medium confidence — compatibility defaults worth deleting

- **`se-server` dual route** — `/statechain` (legacy) and `/v1/statechain` both
  mounted: `se-server/src/index.ts:52-65`. Keep only if deployed clients exist.
- **`edge-mqtt` unsigned-command opt-out** — `requireSignedCommands: false`
  restores legacy unsigned mode: `edge-mqtt/src/command-handler.ts:147-158`;
  `types.ts:281`. Pre-launch, remove the opt-out.
- **`txpow` legacy broadcast callback** — `broadcastBlockCandidate` retained as
  a compatibility/fallback path: `txpow/src/admission/types.ts:115,131`;
  `admission/mine.ts:167-168`.
- **`omnia-host` seed signing** — `OMNIA_HOST_SEED`/`OMNIA_HOST_KEYFILE` remain
  the default signing material and `createLocalSignerPort` wraps it:
  `omnia-host/src/config.ts:103-126`; `signing.ts:6,186`;
  `signer-port.ts:20`. Seed **self-custody** is a real feature; the
  compatibility smell is preserving it as the default for hosted-mode
  migrations.
- **`omnia` legacy digest alias** — `computeLegacyTxDraftDigest`:
  `omnia/src/transactions.ts:446`; `index.ts:68`.
- **`omnia` legacy byte-object revival** — JSON-array encoded `Uint8Array`
  signatures are revived on load:
  `omnia/src/persistence.ts:37,58` (`legacyByteObject`). State compatibility.
- **Small public aliases** — `connect/src/index.ts:388` deprecated
  `requestSignature`; `lookup-client/src/types.ts:9` transport alias;
  `pubsub-transport/src/index.ts:45` `MqttClientPort`; `recursive-mast/src/index.ts:40`
  re-export. Low cost, but still user-facing surface.

### 4.3 Justified compatibility — keep

- `chain-provider/src/verify-deposit.ts:142` — legacy chunk MMR proofs
  (on-chain/proof data).
- `wots-lease` watermark seeding and monotonicity guards — safety, not user
  appeasement.
- `state-port-registry.json` legacy port band `0–99` — on-chain script
  allocation.
- `lookup-protocol` legacy `sig` field — wire compatibility if nodes are
  deployed.
- `recursive-mast/src/kissvm/simulation.ts:23-28` — `allowLegacyMastBranches`
  is an explicit **off-by-default dev flag**, not a user shim.
- `omnia` persisted channel snapshots and `legacyByteObject` — only if real
  deployed channels exist.

### 4.4 Stale comments found during the audit

- `packages/omnia/src/types.ts:9-10` says the legacy flat `wotsSign` output is
  “still accepted during the RFC-037 migration,” but
  `packages/omnia/src/wots.ts:10,23-40` shows the flat scheme was retired;
  `verifyChannelSignature` only accepts a serialized `TreeSignature`. Update or
  delete the stale comment rather than preserving a code path that no longer
  exists.
- `packages/kissvm/docs/TEMPLATES.md:38` and
  `packages/mcp-server/src/template-catalog.ts:117` still advertise the old
  `buildTxPoWValidationScript` name. Update them with the rename.

---

## 5. RFC ↔ code cross-reference

| RFC decision | Code that carries it | Cleanup |
|---|---|---|
| RFC-001 legacy/dual init | `SdkMigrationManager`, `SdkTelemetry`, `FeatureFlags` | Remove legacy mode/telemetry/rollback |
| RFC-016 aliases | `kissvm/txpow.ts`, `tx-builder/fund-tx.ts` | Delete aliases, update MCP catalog/docs |
| RFC-031 `/legacy` | `core/src/legacy.ts`, `core/package.json`, README | Delete unless a real non-WASM target needs it |
| RFC-009 flat witness | `kissvm/src/witness.ts` | Require canonical signature form |
| RFC-019 `createEdge().buy()` | `edge/src/create-edge.ts:166,378` | Remove agent-facing path |
| RFC-058/061 seed compatibility | `omnia-host/src/config.ts`, `signing.ts`, `signer-port.ts` | Seed only for explicit self-custody |
| RFC-014-A absent probe | capability manifest / wallet runtime | Require explicit probe |
| RFC-032-A ticketless nodes | `lookup-protocol` / `lookup-node` | Keep only if deployed nodes |
| RFC-036 `sendTransaction` callers | `server` | Verify callers before changing |
| RFC-057 Pear subpaths | `pear` exports | Collapse if no Pear users |

---

## 6. Recommended policy

### 6.1 `COMPATIBILITY.md` (new, short)

> **Pre-1.0 compatibility policy**
>
> 1. The SDK is pre-release. Breaking changes are allowed in minor/patch
>    releases until the first supported production release.
> 2. No aliases, deprecation windows, dual code paths, migration guides or
>    “restore old behaviour” flags are added for SDK consumers.
> 3. Compatibility is preserved only for:
>    - persisted local state that may contain value or signing history;
>    - on-chain scripts, addresses and committed state;
>    - wire protocols with deployed peers;
>    - explicit security fail-closed defaults.
> 4. When a persisted format must change, bump the format version and either
>    migrate once or fail closed with a clear error. Do not carry the old format
>    indefinitely.
> 5. Protocol/state compatibility must be justified in the RFC by the data it
>    protects, not by “existing callers.”
> 6. A comment claiming compatibility must point to the code path that
>    implements it; stale comments are bugs.

### 6.2 CI guard

Add a lightweight gate (e.g. `scripts/check-legacy-surface.mjs`) that fails when
a publishable package adds any of:

- a new `@deprecated` export;
- a new `/legacy`, `legacy*`, `compat*` or `backward*` export/subpath;
- a new `SdkInitMode`/`legacy|sdk` dual dispatch;
- a new “restore old behaviour” flag (`allowLegacy*`, `fallbackOnError`,
  `requireSignedCommands: false`, etc.).

Allow-list entries must name the protected data (state/on-chain/wire) and an
owning RFC. The gate should run in the existing `verify-workspace --lint` or a
dedicated CI step.

### 6.3 What still counts as justified

- Local storage schema migrations where the state can contain funds, signing
  history or recovery material.
- On-chain script/address continuity.
- Wire compatibility with deployed nodes or channels.
- Security defaults that fail closed.
- Explicit dev-only flags that default **off** and are not part of the public
  API.

---

## 7. Cleanup plan

**Phase 0 — policy and guard**
Write `COMPATIBILITY.md`; add the CI guard; add this audit to the docs index if
needed.

**Phase 1 — extension rollout and storage**
Remove `SdkMigrationManager`/`SdkTelemetry`/`FeatureFlags` legacy mode and admin
rollout. Replace legacy watermark/lease migrations with a version reset or a
single explicit migration. Remove `getApiKey`, legacy `request`, and the legacy
handler bridge. Update PWA provider if it has its own legacy mode.

**Phase 2 — connect method set**
Collapse `LEGACY_METHODS` + `TOTEM_METHODS` to one canonical set. Update
extension/PWA dispatch and the parity tests. Keep a single documented wire
contract.

**Phase 3 — package aliases**
Delete `core` `/legacy`, `legacy*` exports and the alias inventory in §4.1
(except byte-compatibility wrappers required by Java/Minima). Delete
`buildTxPoWValidationScript` and `DeepFundingProof` aliases; update the MCP
catalog and docs. Remove flat witness support.

**Phase 4 — Omnia/state compatibility**
Confirm whether any deployed channels/snapshots exist. If not, remove
`computeLegacyTxDraftDigest`, `legacyByteObject`, and the stale flat-signature
comment. If yes, keep only the persisted-state path and document the data it
protects.

**Phase 5 — medium items**
Decide `se-server` legacy route, `edge-mqtt` unsigned opt-out, `txpow`
broadcast callback, and `omnia-host` seed fallback. Remove anything without a
named protected data set.

**Verification after each phase:** `pnpm typecheck`, `pnpm lint`, `pnpm test`,
`validate:manifest`, `verify:mcp`, plus the existing custody/state-port gates.

---

## 8. Open questions (must be answered before deletion)

1. **Extension adoption:** are there real installed Totem extension wallets with
   v1 watermarks/leases? If yes, Phase 1 storage migrations are justified; if
   not, reset the format.
2. **Deployed channels/factories:** are there Omnia channels or snapshots in the
   field? If yes, keep `legacyByteObject`/persisted signature compatibility.
3. **Deployed lookup/SE nodes:** do any nodes speak the legacy `sig` field or
   `/statechain` route? If yes, keep those wire/API compatibilities.
4. **Non-WASM targets:** is React Native/Hermes (or another no-WASM target)
   actually supported? If yes, keep one frozen `/legacy` target; if not, delete
   `/legacy`.
5. **Wallet implementers:** does any external wallet implement `TOTEM_*`
   uppercase methods? If not, collapse the connect method set.
6. **`se-server` clients:** is the legacy `/statechain` prefix consumed by any
   deployment?

Until these are answered, treat the corresponding findings as **S/P**, not
**U**.

---

## 9. Audit evidence

Search patterns used across the SDK (excluding `dist`, `node_modules`, tests
where noted):

- `@deprecated`
- `backward|backwards|back-compat|compatibility`
- `legacy`
- `shim|workaround|polyfill`
- `migration|migrate`
- `existing caller|existing user|existing consumer|already published`
- `keep .* working|remain .* unchanged|preserve .* behavio|restore .* old`
- dual dispatch patterns: `initMode`, `fallbackOnError`,
  `allowLegacy*`, `requireSignedCommands`, `legacyFn|sdkFn`

Key files were read in full around each hit; the file:line references above are
the evidence. The audit did not execute a live extension or multi-node network.
Adoption answers in §8 determine whether an **S/P** finding should be retained.
