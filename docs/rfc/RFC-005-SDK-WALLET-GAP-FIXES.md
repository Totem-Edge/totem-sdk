# RFC-005: SDK & Wallet Gap Fixes — Complex Contract / NFT-Minting Surface

**Status:** Draft
**Created:** 2026-09-10
**Authors:** Totem SDK Contributors
**Reviewers:** [Pending stakeholder assignment]

---

## 1. Summary

The Totem SDK is currently production-ready for simple sends and Omnia payment channels. However, the surface area for complex contracts (multisig, HTLC, MAST, stateful scripts), token/NFT creation, and advanced wallet integration has significant gaps that block any dApp beyond basic payments.

This RFC identifies 11 gaps, triages them by impact, and defines a phased implementation plan. The gaps are organized into three tiers:

- **Tier 1 (Shared foundation):** Gaps #1, #3, #5, #6 — block any dApp doing custom-script txs, stateful contracts, or UTXO inspection
- **Tier 2 (Token/NFT surface):** Gaps #2, #11 — block token creation, NFT minting, RWA launches
- **Tier 3 (Ergonomics):** Gaps #4, #7, #8, #9, #10 — improve developer experience, non-browser support, and approval UX

Only one gap (#10, approval popup) is Manifest-specific. All others are general SDK/wallet issues affecting any dApp on the stack.

## 2. Motivation

Any dApp beyond basic payments hits these gaps:

| Gap | Who is blocked |
|-----|---------------|
| #1 TOTEM_SEND_COMPLEX broken | Multisig, HTLC, MAST, exchange, vault, stateful contract apps |
| #3 send wrapper drops state/storestate | Games, vesting, RWA, supply chain (stateful-contract apps) |
| #5 kissvmSimulate/kissvmValidate unimplemented | Contract apps wanting wallet-side script simulation |
| #6 getCoins limited | Apps needing UTXO state, non-spendable coins, or `mmrentry` data |
| #2/#11 No token creation | NFT/token/RWA launch apps |
| #9 tx-builder doesn't serialize | Any app building transactions without the extension |
| #10 Approval popup shows first output only | Any multi-output transaction UX |
| #4 RPC_COMMAND allowlist | Apps needing additional read-only queries |
| #7 WalletDiscovery needs window | Headless/CLI/Bare-only apps |
| #8 Alpha templates | Apps relying on recursive-mast templates |

The first five are critical path. Without them, the SDK is limited to simple sends and Omnia channels.

## 3. Current State

### 3.1 Gap Inventory

| # | Gap | Severity | Root Cause | Impact |
|---|-----|----------|------------|--------|
| 1 | TOTEM_SEND_COMPLEX broken | **CRITICAL** | `WOTS_BUILD_UNSIGNED` and `WOTS_SEND_COMPLEX` handlers missing in extension background | Both build and submit modes return `Unknown method` |
| 2 | No token creation via wallet | **CRITICAL** | No `TOTEM_TOKENCREATE` message type, handler, SDK method, or UI | NFT/token/RWA apps cannot mint through extension |
| 3 | send wrapper drops state/storestate | **HIGH** | `sendTransaction()` sends `{address, amount, tokenId?}` — no `state`/`storestate` fields | Stateful-contract apps cannot use simple send |
| 4 | RPC_COMMAND allowlist | **MEDIUM** | Hardcoded 6-command set, no config mechanism | Apps needing additional read-only queries blocked |
| 5 | kissvmSimulate/kissvmValidate unimplemented | **HIGH** | Connect SDK functions are dead-ends; no handler in extension or PWA wallet | Contract apps cannot simulate scripts in wallet |
| 6 | getCoins limited | **HIGH** | Extension strips `storestate`, `state`, `mmrentry`, `spent`; no `sendable`/`relevant` filter | UTXO inspection apps blocked |
| 7 | WalletDiscovery needs window | **MEDIUM** | `WalletDiscovery` uses `window` CustomEvents only; no non-browser fallback | Headless/CLI/Bare-only apps cannot discover wallets |
| 8 | Alpha templates | **LOW** | 19 recursive-mast templates marked "EXPERIMENTAL"; no per-template stability markers | Apps relying on templates lack stability guarantees |
| 9 | tx-builder doesn't serialize | **HIGH** | `@totemsdk/tx-builder` provides coin selection and types but no binary serialization | Must pair with core for transaction building |
| 10 | sendComplex intent auto-detection | **MEDIUM** | `TxApprovalParams` has single `to`/`amount`/`tokenId`; popup shows first output only | Multi-output txs show misleading approval UI |
| 11 | No tokencreate wrapper | **CRITICAL** | No `createToken()` method in connect SDK | dApps cannot programmatically create tokens |

### 3.2 Dependency Graph

```
Gap #9 (tx-builder serialization)
  └── Gap #1 (TOTEM_SEND_COMPLEX) — needs serialization to build unsigned blobs

Gap #1 (TOTEM_SEND_COMPLEX)
  └── Gap #10 (approval popup) — needs multi-output params to display correctly

Gap #2/#11 (token creation)
  └── Independent — can be built in parallel with Tier 1

Gap #3 (send wrapper state)
  └── Independent — touches connect SDK types + TOTEM_SEND_TRANSACTION handler

Gap #5 (kissvm simulate/validate)
  └── Independent — @totemsdk/kissvm already has the implementation

Gap #6 (getCoins enrichment)
  └── Independent — extends existing handler response shape
```

## 4. Detailed Gap Analysis

### 4.1 Gap #1: TOTEM_SEND_COMPLEX Broken

**Files involved:**
- `extensions/totem-extension/src/background/index.ts:3511-3848` — primary handler
- `packages/connect/src/index.ts:259-284` — SDK `sendComplex()` function
- `packages/connect/src/types.ts:1082-1209` — type definitions
- `extensions/totem-pwa-wallet/src/provider/provider-entry.ts:147-153` — PWA wallet serialization
- `extensions/totem-pwa-wallet/src/approval/SendApproval.tsx:1-279` — PWA approval page

**Current behavior:** The `TOTEM_SEND_COMPLEX` handler dispatches to `WOTS_BUILD_UNSIGNED` (build mode) and `WOTS_SEND_COMPLEX` (submit mode). Neither case exists in `handleMessage`. Both fall through to `default:` and return `{ ok: false, error: "Unknown method: ..." }`.

**PWA wallet:** `paramsToQs()` extracts `bp.to`, `bp.amount`, `bp.tokenId` — fields that don't exist on `EnhancedBuildParams` (which has `inputs[]` and `outputs[]`). The serialized query string has no transaction data.

**PWA approval:** `SendApproval.tsx` reads `to`/`amount`/`tokenId` from URL params and performs simple single-output coin selection. Multi-input/output/script data is ignored.

**Fix:**
1. Add `case 'WOTS_BUILD_UNSIGNED'` — use `MinimaTransactionBuilder` to serialize, return unsigned blob + blobHash
2. Add `case 'WOTS_SEND_COMPLEX'` — build, sign, broadcast, return txpowid
3. Fix PWA `paramsToQs()` to serialize `inputs[]`/`outputs[]` as JSON
4. Extend `SendApproval.tsx` to parse and display complex transaction data

### 4.2 Gap #2: No Token Creation via Wallet

**Files involved:**
- `extensions/totem-extension/src/content-script.ts:11-29` — `ALLOWED_DAPP_METHODS`
- `extensions/totem-extension/src/background/index.ts` — no `TOTEM_TOKENCREATE` case
- `packages/connect/src/index.ts` — no `createToken()` export
- `packages/connect/src/types.ts` — no token creation types

**Current behavior:** The only token-related code is `TOKENID_CREATE = '0xff'` used for normalization in `txncheck.ts`. There is no message type, handler, SDK method, or UI for creating tokens.

**Fix:**
1. Add `TOTEM_TOKENCREATE` to `ALLOWED_DAPP_METHODS`
2. Add handler in background — validate params, show approval, call Minima `tokencreate` RPC
3. Add `createToken()` to connect SDK with proper types
4. Add `token_create` intent to `DAppTransactionIntent`

### 4.3 Gap #3: send wrapper drops state/storestate

**Files involved:**
- `packages/connect/src/index.ts:231-245` — `sendTransaction()` wrapper
- `packages/connect/src/types.ts:1011-1025` — `TotemSendTransactionRequest` type
- `extensions/totem-extension/src/background/index.ts:3047-3240` — `TOTEM_SEND_TRANSACTION` handler

**Current behavior:** `sendTransaction()` sends `{ address, amount, tokenId? }` per output. No `state` or `storestate` fields. The complex path (`sendComplex()` / `EnhancedBuildParams`) does support these fields, but requires pre-selected coins and explicit script descriptors — a much higher barrier.

**Fix:**
1. Extend `TotemSendTransactionRequest.outputs` with optional `state?: StateVariable[]` and `storestate?: boolean`
2. Update `sendTransaction()` to pass through these fields
3. Update `TOTEM_SEND_TRANSACTION` handler to forward to transaction builder
4. Surface state changes in approval popup

### 4.4 Gap #4: RPC_COMMAND Allowlist

**Files involved:**
- `extensions/totem-extension/src/background/index.ts:4312-4390` — `RPC_ALLOWED_COMMANDS`

**Current behavior:** Hardcoded `Set` of 6 commands: `txpow`, `balance`, `coins`, `tokens`, `txlist`, `status`. No configuration mechanism.

**Note:** The allowlist should only expand based on actual dApp demand. Adding unused commands (e.g., `maxima`) is speculative and increases attack surface without consumer benefit. Current 6 commands cover the read-only query needs of existing dApps.

**Fix:**
1. Expand with `version` and `wots/status` only if dApps request them
2. Consider configurable allowlist via extension storage (future improvement)
3. Document available commands in connect SDK README

### 4.5 Gap #5: kissvmSimulate/kissvmValidate Unimplemented

**Files involved:**
- `packages/connect/src/index.ts:706-724` — public API wrappers (defined, call through to provider)
- `packages/connect/src/types.ts:741-770` — request/response types
- `packages/kissvm/src/simulate.ts:57-94` — real `simulateSpend()` implementation
- `extensions/totem-extension/src/background/index.ts` — no handler
- `extensions/totem-pwa-wallet/src/provider/provider-entry.ts:100-101` — returns `null`

**Current behavior:** Connect SDK functions call `provider.request({ method: 'totem_kissvmSimulate' })`. Neither wallet handles these messages. The `@totemsdk/kissvm` package has a working `simulateSpend()` implementation that is never reached through the wallet proxy.

**Fix:**
1. Add `case 'totem_kissvmSimulate'` and `case 'totem_kissvmValidate'` to extension background — import and call `@totemsdk/kissvm` functions
2. Remove from PWA wallet `unsupportedMethods` set and implement (Web Worker with WASM or defer to extension)

### 4.6 Gap #6: getCoins Limited

**Files involved:**
- `packages/connect/src/index.ts:247-257` — `getCoins()` wrapper
- `packages/connect/src/types.ts:1047-1080` — response types
- `extensions/totem-extension/src/background/index.ts:3421-3509` — `TOTEM_GET_COINS` handler

**Current behavior:** Extension returns `{ coinId, address, amount, tokenId, created }` per coin. Strips `storestate`, `state`, `mmrentry`, `token`, `spent`. No `sendable`/`relevant`/`megammr` filtering exposed.

**Fix:**
1. Extend response type with optional `storestate`, `state`, `spent` fields
2. Update handler to pass these through
3. Expose `sendable` and `relevant` filter params in connect SDK

### 4.7 Gap #7: WalletDiscovery Needs Window

**Files involved:**
- `packages/connect/src/index.ts:105-196` — `WalletDiscovery` class

**Current behavior:** Uses `window.addEventListener`/`CustomEvent` for discovery. No fallback for Node.js/SSR/web-worker/CLI. No timeout mechanism — two fixed retries at 150ms and 800ms, then silent failure.

**Fix:**
1. Add optional `provider` parameter for programmatic injection (non-window contexts)
2. Add `waitForWallet(timeoutMs)` convenience method returning a Promise
3. Add `onTimeout` callback option

### 4.8 Gap #8: Alpha Templates

**Files involved:**
- `packages/recursive-mast/src/index.ts:35` — "EXPERIMENTAL" marker
- `packages/mcp-server/src/template-catalog.ts:1-410` — 39 template entries

**Current behavior:** 19 recursive-mast templates at v0.2.6 marked "EXPERIMENTAL". No per-template stability markers. No usage examples or caveats documentation.

**Fix:**
1. Add `stability: 'experimental' | 'beta' | 'stable'` metadata to template catalog
2. Add per-template README/JSDoc with examples and caveats
3. Graduate mature templates (e.g., `access-control`, `recovery`) to `beta`

### 4.9 Gap #9: tx-builder Doesn't Serialize

**Files involved:**
- `packages/tx-builder/src/index.ts` — 6 lines, re-exports
- `packages/tx-builder/src/enhanced-types.ts` — type definitions only
- `extensions/totem-extension/src/core/transaction/MinimaTransactionBuilder.ts` — actual serialization (extension-internal)

**Current behavior:** `@totemsdk/tx-builder` provides coin selection, types, and decimal math. No binary serialization. Actual Minima transaction serialization lives in the extension's internal `MinimaTransactionBuilder`.

**Fix:**
1. Extract serialization logic from extension into `@totemsdk/tx-builder` as a public export
2. Or: create `serialize()`/`deserialize()` pair in tx-builder working with `EnhancedBuildParams`
3. This is foundational — prerequisite for Gap #1 (`WOTS_BUILD_UNSIGNED`)

### 4.10 Gap #10: sendComplex Intent Auto-Detection

**Files involved:**
- `extensions/totem-extension/src/background/index.ts:3584-3594` — intent detection
- `extensions/totem-extension/src/background/index.ts:3620-3630` — approval params construction
- `extensions/totem-extension/src/approval/tx-approval.js:1-164` — extension approval popup
- `extensions/totem-pwa-wallet/src/approval/SendApproval.tsx:1-279` — PWA approval page

**Current behavior:** `TxApprovalParams` has single `to`/`amount`/`tokenId`. For multi-output txs, the popup shows only the first output address but the sum of all amounts. Intent detection examines input `scriptDescriptor.scriptType` but doesn't consider output patterns.

**Fix:**
1. Extend `TxApprovalParams` with `outputs?: Array<{address, amount, tokenId}>`
2. Update approval popup to render all recipients
3. Improve intent detection to consider output patterns (e.g., `storeState` → contract interaction)

### 4.11 Gap #11: No tokencreate Wrapper

This is the connect SDK side of Gap #2. Covered in §4.2.

## 5. Design Decisions

### 5.1 Serialization extraction (Gap #9)

**Decision:** Extract `MinimaTransactionBuilder` serialization from the extension into `@totemsdk/tx-builder`.

**Rationale:** The serialization code is general-purpose Minima transaction formatting. Keeping it extension-internal means any non-extension consumer (PWA wallet, CLI tools, server-side builders) must reimplement it. Moving it to the shared package enables:
- Gap #1 (`WOTS_BUILD_UNSIGNED`) to use it directly
- PWA wallet to build transactions without the extension
- Third-party tools to serialize Minima transactions

**Alternative considered:** Duplicate the serialization in tx-builder. Rejected — code duplication between extension and package creates maintenance burden and divergence risk.

### 5.2 Token creation path (Gaps #2, #11)

**Decision:** Implement as a new `TOTEM_TOKENCREATE` message type with a dedicated handler, rather than reusing `TOTEM_SEND_COMPLEX` with a token-creation script.

**Rationale:** Token creation on Minima uses the special `tokenId = 0xff` sentinel and has distinct parameters (token name, amount, description, script). Mapping it to `sendComplex` would require the dApp to construct the sentinel and special outputs manually, which is error-prone and leaks Minima implementation details. A dedicated method provides a cleaner API.

### 5.3 kissvm execution environment (Gap #5)

**Decision:** Implement in the extension background first, defer PWA wallet implementation.

**Rationale:** The `@totemsdk/kissvm` package uses synchronous WASM evaluation. The extension background (service worker) can import and call it directly. The PWA wallet would need a Web Worker to avoid blocking the main thread, which is a larger undertaking. The extension path unblocks dApps immediately; the PWA wallet can follow.

### 5.4 RPC allowlist expansion (Gap #4)

**Decision:** Do not expand the allowlist speculatively. Only add commands when an existing dApp requests them.

**Rationale:** The allowlist is a security boundary. Every added command is attack surface. The current 6 commands (`txpow`, `balance`, `coins`, `tokens`, `txlist`, `status`) cover the read-only query needs of existing Totem dApps. Adding unused commands (e.g., `maxima`, `version`) provides no consumer benefit while increasing exposure.

## 6. Implementation Plan

### Phase 1: Serialization Foundation

**Gap #9: tx-builder serialization**

| Task | Files | Effort |
|------|-------|--------|
| Extract `serializeTransaction()` from extension `MinimaTransactionBuilder` into tx-builder | `packages/tx-builder/src/serialize.ts` (new), `extensions/totem-extension/src/core/transaction/MinimaTransactionBuilder.ts` | Medium |
| Add `deserializeTransaction()` for round-trip | `packages/tx-builder/src/serialize.ts` | Medium |
| Add unit tests with Minima golden vectors | `packages/tx-builder/src/__tests__/serialize.test.ts` | Medium |
| Re-export from tx-builder index | `packages/tx-builder/src/index.ts` | Low |

**Acceptance criteria:**
- `serializeTransaction(EnhancedBuildParams)` produces byte-exact Minima transaction bytes
- `deserializeTransaction(bytes)` reconstructs the original params
- Tests pass against known Minima transaction fixtures
- Extension background can use the new public export instead of internal code

### Phase 2: Core Send Infrastructure

**Gap #1: TOTEM_SEND_COMPLEX**

| Task | Files | Effort |
|------|-------|--------|
| Add `case 'WOTS_BUILD_UNSIGNED'` handler | `extensions/totem-extension/src/background/index.ts` | High |
| Add `case 'WOTS_SEND_COMPLEX'` handler | Same file | High |
| Fix PWA `paramsToQs()` serialization | `extensions/totem-pwa-wallet/src/provider/provider-entry.ts` | Medium |
| Extend `SendApproval.tsx` for complex txs | `extensions/totem-pwa-wallet/src/approval/SendApproval.tsx` | High |
| Add tests for both modes | New test files | Medium |

**Acceptance criteria:**
- `sendComplex(origin, params, 'build')` returns `{ blob, blobHash }` with valid unsigned transaction
- `sendComplex(origin, params, 'submit')` broadcasts and returns `{ txpowid }`
- PWA wallet correctly serializes and displays complex transactions
- Approval popup shows all inputs and outputs

**Gap #3: send wrapper state/storestate**

| Task | Files | Effort |
|------|-------|--------|
| Extend `TotemSendTransactionRequest.outputs` type | `packages/connect/src/types.ts` | Low |
| Update `sendTransaction()` to pass state/storestate | `packages/connect/src/index.ts` | Low |
| Update `TOTEM_SEND_TRANSACTION` handler | `extensions/totem-extension/src/background/index.ts` | Medium |
| Surface state changes in approval popup | `extensions/totem-extension/src/approval/tx-approval.js` | Medium |
| Add tests | New test files | Low |

**Acceptance criteria:**
- `sendTransaction(origin, [{ address, amount, state }])` preserves state in the built transaction
- `sendTransaction(origin, [{ address, amount, storestate: true }])` sets storestate on the output
- Approval popup shows state changes when present

**Gap #10: approval popup multi-output**

| Task | Files | Effort |
|------|-------|--------|
| Extend `TxApprovalParams` with `outputs[]` | `extensions/totem-extension/src/background/index.ts` | Low |
| Update `showTransactionApprovalPopup()` | Same file | Medium |
| Update `tx-approval.js` to render all recipients | `extensions/totem-extension/src/approval/tx-approval.js` | Medium |
| Update PWA approval to render all recipients | `extensions/totem-pwa-wallet/src/approval/SendApproval.tsx` | Medium |

**Acceptance criteria:**
- Multi-output transactions show all recipient addresses in approval popup
- Each output shows its amount and tokenId separately

### Phase 3: Extended Capabilities

**Gap #5: kissvm simulate/validate**

| Task | Files | Effort |
|------|-------|--------|
| Add `case 'totem_kissvmSimulate'` to extension background | `extensions/totem-extension/src/background/index.ts` | Medium |
| Add `case 'totem_kissvmValidate'` to extension background | Same file | Medium |
| Import and call `@totemsdk/kissvm` functions | Same file | Low |
| Add unit tests | New test files | Medium |

**Acceptance criteria:**
- `kissvmSimulate(origin, params)` returns simulation results from `@totemsdk/kissvm`
- `kissvmValidate(origin, { script })` returns validation result
- Both methods work through the extension wallet proxy

**Gap #6: getCoins enrichment**

| Task | Files | Effort |
|------|-------|--------|
| Extend `TotemGetCoinsSuccessResponse` | `packages/connect/src/types.ts` | Low |
| Update `TOTEM_GET_COINS` handler | `extensions/totem-extension/src/background/index.ts` | Medium |
| Expose `sendable`/`relevant` in `CoinsQuery` | `packages/connect/src/types.ts` | Low |
| Update `getCoins()` to accept filter params | `packages/connect/src/index.ts` | Low |
| Add tests | New test files | Low |

**Acceptance criteria:**
- `getCoins()` returns `storestate`, `state`, `spent` when requested
- `getCoins({ sendable: true })` filters to unspent coins only
- `getCoins({ relevant: true })` returns coins relevant to the query

**Gap #4: RPC_COMMAND allowlist**

| Task | Files | Effort |
|------|-------|--------|
| Add `version` and `wots/status` if dApps request them | `extensions/totem-extension/src/background/index.ts` | Low |
| Document available commands | `packages/connect/README.md` | Low |

**Acceptance criteria:**
- All commands in allowlist are documented
- No speculative commands added without consumer demand

### Phase 4: Token/NFT Surface

**Gaps #2, #11: token creation**

| Task | Files | Effort |
|------|-------|--------|
| Add `TOTEM_TOKENCREATE` to `ALLOWED_DAPP_METHODS` | `extensions/totem-extension/src/content-script.ts` | Low |
| Add `case 'TOTEM_TOKENCREATE'` handler | `extensions/totem-extension/src/background/index.ts` | High |
| Add `createToken()` to connect SDK | `packages/connect/src/index.ts` | Medium |
| Add `TotemCreateTokenRequest`/`Response` types | `packages/connect/src/types.ts` | Low |
| Add `token_create` intent | `packages/connect/src/types.ts`, `extensions/totem-extension/src/core/dapp/TotemSendTransactionTypes.ts` | Low |
| Add approval UI for token creation | `extensions/totem-extension/src/approval/tx-approval.js` | Medium |
| Add tests | New test files | Medium |

**Acceptance criteria:**
- `createToken(origin, { name, amount, description, script })` creates a token via wallet proxy
- Approval popup shows token name, amount, and description before signing
- Token creation is recorded in transaction history

### Phase 5: Ergonomics

**Gap #7: WalletDiscovery non-browser**

| Task | Files | Effort |
|------|-------|--------|
| Add `provider` parameter for programmatic injection | `packages/connect/src/index.ts` | Medium |
| Add `waitForWallet(timeoutMs)` convenience method | Same file | Low |
| Add `onTimeout` callback option | Same file | Low |
| Add tests | New test files | Low |

**Acceptance criteria:**
- `new WalletDiscovery({ provider: myProvider })` works without `window`
- `await discovery.waitForWallet(5000)` resolves when wallet is found or times out
- `onTimeout` callback fires when no wallet is discovered within timeout

**Gap #8: template stability markers**

| Task | Files | Effort |
|------|-------|--------|
| Add `stability` field to template catalog | `packages/mcp-server/src/template-catalog.ts` | Low |
| Add per-template JSDoc with examples | `packages/recursive-mast/src/templates/*.ts` | Medium |
| Graduate mature templates to `beta` | Same files | Low |

**Acceptance criteria:**
- Every template has a `stability` metadata field
- Per-template documentation includes usage examples and known limitations

## 7. Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Serialization extraction breaks extension internals | Extension cannot build transactions | Extract with parity tests against Minima golden vectors; keep extension fallback until parity proven |
| Token creation approval UI complexity | Delayed Phase 4 | Start with minimal approval (name + amount); enhance in follow-up |
| kissvm WASM in service worker | Extension background may not support WASM imports | Verify service worker WASM support; fall back to Web Worker if needed |
| PWA wallet complex tx support | Large UI rewrite for SendApproval.tsx | Defer to Phase 2 follow-up; extension path unblocks dApps immediately |
| Template stability graduation errors | Incorrect stability labels | Require review before graduating from experimental to beta |

## 8. Open Questions

1. **Serialization extraction scope** — Should we extract the full `MinimaTransactionBuilder` or just the `serialize()` function? Full extraction enables more reuse but is a larger change.
2. **Token creation approval** — Should token creation use the standard `TxApprovalParams` flow or a custom approval page with token-specific fields (name, description, script preview)?
3. **kissvm Web Worker** — For the PWA wallet, should we implement a Web Worker with WASM, or defer to a later phase?
4. **getCoins backward compatibility** — Adding new fields to the response is non-breaking, but should we version the response type?
5. **RPC allowlist configurability** — Is a configurable allowlist (via extension storage) worth the complexity, or is the hardcoded set sufficient for the foreseeable future?

## 9. Appendix: Affected dApp Categories

| dApp Type | Gaps Hit | Priority |
|-----------|----------|----------|
| Multisig wallet | #1, #9, #10 | Tier 1 |
| HTLC exchange | #1, #9, #10 | Tier 1 |
| MAST contract | #1, #5, #9, #10 | Tier 1 |
| Stateful game | #1, #3, #5, #9, #10 | Tier 1 |
| NFT marketplace | #2, #11, #6 | Tier 2 |
| Token launcher | #2, #11 | Tier 2 |
| RWA platform | #2, #3, #11 | Tier 2 |
| Vesting contract | #3, #5 | Tier 1 |
| Supply chain tracker | #3, #6 | Tier 1 |
| CLI/Node.js tool | #7, #9 | Tier 3 |
| Headless dApp | #7 | Tier 3 |
