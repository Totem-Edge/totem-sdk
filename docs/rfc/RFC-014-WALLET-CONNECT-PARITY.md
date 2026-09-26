# RFC-014: Wallet Connect Parity & Shared Execution Bridge

**Status:** Landed — P1–P6 (structural parity) + first execution-wiring increment. `@totemsdk/connect/wallet` introduces the canonical `CONNECT_METHODS` (46) + `WALLET_INTERNAL_METHODS`, the frozen disposition table, structural ports, `createWalletRuntime`, and `buildWalletCapabilityManifest` (13-test conformance). Both wallets adopt the shared runtime at their dispatch boundary; the parity audit is runtime-aware, `KNOWN_GAPS` is empty, and both wallets report **46/46 served**. **Execution wiring landed (extension):** the `signer` port bridges lowercase `totem_*` methods to the extension's existing legacy handlers (`totem_signTransaction`, `totem_broadcastTxPoW`, `totem_getWotsStatus`, `totem_getAccounts`-class, …); `selfHosted` handles `totem_setChainProvider` (Axia-only; self-hosted node selection is user-driven); `receipts` serves `totem_getTransactionStatus`/`totem_getReceipt` from the persisted receipt store; and `lease` serves `totem_reserveWotsLease`/`totem_releaseWotsLease` from the RFC-013 self-hosted lease provider (Axia mode returns explicit `unsupported`). **Remaining (non-blocking):** wire the execution families (Omnia/statechain/kissvm) as **approval-gated SDK/chain calls** in each wallet; PWA execution ports (approval-page bridge). The wallet does **not** construct a governed Edge runtime — mandate-bound autonomy stays in autonomous hosts and is supplied via the optional `edge` port (§6.4). Open questions Q1–Q4 resolved (§13).
**Created:** 2026-09-24
**Authors:** Totem SDK Contributors
**Reviewers:** [Pending stakeholder assignment]
**Depends on:** `@totemsdk/connect` (method contract), `@totemsdk/edge` (governed runtime + ports), RFC-008 (SE/statechain), RFC-010 (owner migration), RFC-013 (self-hosted mode)
**Companion audit:** `docs/audits/wallet-connect-parity-2026-09.md` (T1–T5)

---

## 1. Summary

The parity audit found the Totem Extension and Totem PWA both re-implement the
`@totemsdk/connect` wire protocol by hand and have drifted: **extension 11/46**
methods handled, **PWA 19/46**, and the entire **Omnia, Statechain, KISSVM,
Agent, payment-request, mining, and receipt/status** families are served by
neither. This RFC closes those gaps and makes parity **structural rather than
manual** by:

1. making `@totemsdk/connect` the single source of truth for method/type constants;
2. introducing a **shared wallet handler module** used by both wallets, so a
   method is implemented once;
3. routing the execution families (Omnia/Statechain/KISSVM/Agent/payments)
   through the **governed Edge runtime** (or the relevant SDK client) instead of
   embedding them in each wallet;
4. exposing one **capability/method-support manifest** from that shared source.

This is the wallet-side companion to RFC-013: RFC-013 decides *where chain data
and key use come from*; RFC-014 decides *how every connect method is served*.

## 2. Motivation

- `extensions/totem-extension/src/background/index.ts` dispatches ~22 verbs by
  string; `extensions/totem-pwa-wallet/src/provider/provider-entry.ts` routes to
  approval pages and stubs 27 methods (`UNSUPPORTED`). Neither imports
  `@totemsdk/connect`.
- The extension only recognises uppercase `TOTEM_*`; the newer connect methods are
  lowercase `totem_*`, so the new families are invisible to it.
- The two wallets are complementary, not at parity: the PWA has status/lease/
  sign methods the extension lacks; the extension has streaming/snapshots/site
  management the PWA lacks.
- The audit's machine gate (`scripts/audit-wallet-connect-parity.mjs`) prevents
  *new* drift but does not implement anything.

## 3. Goals

- Both wallets serve **100% of connect methods**, each as `handled` or an
  explicit `unsupported` (reason from the support manifest) — never silently
  ignored.
- One implementation per method, shared across wallets.
- Execution families route through Edge/SDK, not duplicated wallet code.
- One capability/support manifest consumed by both wallets and Axia.
- The anti-drift gate stays green in CI.

## 4. Non-goals

- Changing the connect protocol/method signatures.
- Wallet-side re-implementation of Omnia/Statechain/KISSVM/Agent internals.
- Self-hosted chain/lease selection (RFC-013).
- dApp UI/UX beyond the wallet approval surface.

## 5. Current state (evidence)

| Surface | Extension | PWA |
|---|---|---|
| Method dispatch | `case 'TOTEM_*'` switch | `methodToPath` + inline `if` + `unsupportedMethods` |
| Handled / 46 | 11 | 19 |
| Missing/stub | 35 | 27 |
| `@totemsdk/connect` dep | ❌ (comment only) | ❌ (comment only) |
| Edge/SDK family deps | ❌ | ❌ |
| Non-connect surface | RPC/streams/snapshots/sites/`WOTS_SEND` | ❌ |

## 6. Architecture

### 6.1 Single source of truth (T1)

Add `@totemsdk/connect` as a real dependency of both wallets and replace the hand
tables with its exported method/type constants. A shared **wallet method
registry** is derived from those constants so `TOTEM_*` and `totem_*` names, and
their capability requirements, cannot diverge.

### 6.2 Shared wallet handler module (T4)

Introduce one implementation, consumed by both wallets, ideally as a new
`@totemsdk/connect/wallet` subpath (preferred — no new top-level package; the
wallet-side counterpart to the dApp-side client) or, if the surface grows, a
dedicated `@totemsdk/wallet-runtime` package.

```ts
interface WalletHandlerContext {
  signer: WalletSigner;              // WOTS/TreeKey signing, no raw keys exposed
  approvals: ApprovalPort;           // user consent (approval pages)
  chain: ChainStateProvider;         // RFC-013
  lease?: WotsLeaseProvider;         // RFC-013
  edge?: EdgeDispatch;               // governed runtime dispatch
  capabilities: WalletCapabilitySet;
}

interface WalletMethodHandler {
  method: string;
  requiredCapabilities: readonly string[];
  handle(params: unknown, ctx: WalletHandlerContext, signal?: AbortSignal): Promise<unknown>;
  /** Users must approve before this runs. */
  requiresApproval?: boolean;
}

createWalletRuntime(handlers, ctx): TotemProvider
```

Each wallet supplies concrete `signer`/`approvals`/`chain`/`lease`/`edge`, but
the **method logic lives once**.

### 6.3 Method disposition

Every connect method is classified as one of: **local** (wallet-owned),
**edge-dispatched**, **sdk-client**, or **unsupported** (with a reason).

| Family (methods) | Disposition | Implementation |
|---|---|---|
| `TOTEM_CONNECT`, `TOTEM_DISCONNECT`, `TOTEM_GET_ACCOUNTS`, `TOTEM_GET_COINS`, `TOTEM_SEND_TRANSACTION`, `TOTEM_SEND_COMPLEX`, `TOTEM_SIGN_DATA`, `TOTEM_BROADCAST_HEX`, `TOTEM_VERIFY`, `TOTEM_PROVE_OWNERSHIP`, tx permissions | **local** | shared handlers + approval port |
| `totem_getCapabilities`, `totem_getProviderStatus`, `totem_getWotsStatus` | **local** | support manifest + wallet state |
| `totem_reserveWotsLease`, `totem_releaseWotsLease` | **local** | `wots-lease` (RFC-013) |
| `totem_signTransaction`, `totem_broadcastTxPoW`, `totem_mineTxPoW` | **local** | signer + chain provider |
| `totem_setChainProvider` | **local** | RFC-013 config |
| `totem_getTransactionStatus`, `totem_getReceipt` | **local** (persisted) | wallet store; optional Axia source (§8) |
| `totem_omnia*` (13) | **consent-gated SDK** | `@totemsdk/omnia` client behind the approval port |
| `TOTEM_SEND_TRANSACTION` payment path, `totem_createPaymentRequest`, `totem_payPaymentRequest` | **consent-gated SDK** | payment/send path behind the approval port |
| `totem_statechain*` (4) | **consent-gated SDK** | `@totemsdk/statechain` client + SE (RFC-008) |
| `totem_kissvmSimulate`, `totem_kissvmValidate` | **sdk-client** | `@totemsdk/kissvm` |
| `totem_agent*` (3) | **host-supplied** | an autonomous host's governed/agent bridge (never built in the wallet) |

Extension-internal verbs (`RPC_COMMAND`, `START/STOP_STREAM`, snapshots, site
management, `WOTS_SEND`/`WOTS_SIGN_DATA`) become part of the shared runtime too,
so the PWA reaches extension parity by construction (T3).

### 6.4 Execution boundary: consent vs autonomy (T4)

A wallet is a **consent + signing surface** (MetaMask model), not an autonomous
executor. The two authorization models in the SDK must not be conflated:

- **Consent (wallet, default):** dApp proposes → approval port resolves → SDK
  client call (Omnia/Statechain/KISSVM) or chain action → sign via the signer /
  RFC-013 lease → broadcast. Authority is the **human approval**.
- **Governed autonomy (agents/edge devices):** `GrantBoundAutonomyPolicy`
  mandate → `authorizeAndReserve` → execute → `commit`/`abort`. Authority is a
  **pre-delegated mandate**, for contexts where no human is in the loop
  (RFC-010/011, `@totemsdk/edge` agent runtimes, `se-server`).

The wallet therefore does **not** construct a governed Edge runtime and has no
mandate/run-state store. Execution families are served as:

```text
connect method → shared wallet handler → approval port (user consent)
   → SDK client / chain action (Omnia / Statechain / KISSVM / payment)
   → sign via signer + RFC-013 lease → broadcast
```

An injected `edge` dispatch port remains part of the handler context so a
**host** that genuinely runs an autonomous runtime (an agent, an industrial
edge device) can route governed actions — but that port is supplied by the host,
never built into the browser wallet. This keeps Omnia/Statechain/KISSVM logic in
the SDK (not duplicated per wallet) while keeping mandate-bound authority out of
the extension's dApp-reachable surface. The wallet still never receives raw keys:
it supplies ports and the approval surface.

### 6.5 Capability / method-support manifest (T5 §6.1)

One manifest, sourced from the registry + enabled ports, served by
`totem_getCapabilities`/`totem_getProviderStatus` and (optionally) mirrored to
Axia:

```ts
interface WalletCapabilityManifest {
  wallet: string; version: string;
  methods: Record<string, 'supported' | 'unsupported'>;
  capabilities: string[];           // edge capability strings actually enabled
  reasons?: Record<string, string>; // for unsupported
}
```

## 7. Conformance & the anti-drift gate

- `scripts/audit-wallet-connect-parity.mjs --check` stays in CI.
- Add a **wallet conformance test** run against the shared runtime: every connect
  method is either handled (with a passing mock) or explicitly `unsupported` with
  a reason in the manifest.
- The `KNOWN_GAPS` lists in the gate shrink to empty as T2/T3/T4 land; a method
  can only be `missing` if the manifest declares it `unsupported`.

## 8. Axia surfaces (remaining T5 → RFC-015)

Not all of T5 is wallet-local; **RFC-015** owns the Axia contract changes. The
audit §6 details them:

- **SE registry → RFC-008 shape** (per-member root/proof-version, federation
  descriptor, bond ref, revocation/equivocation epochs).
- **tx status / receipts**: either Axia `GET /v1/transactions/:id` /
  `/v1/receipts/:id`, or the wallets persist locally — decide and do not stub.
- **quota / telemetry**: credit weights for the new families; telemetry records
  proposal vs executed.
- **capability manifest**: Axia may mirror §6.5 for dApp discovery.

## 9. Security

- The shared runtime must not hold signing keys; signing goes through the
  `signer` port (WOTS/TreeKey, RFC-013 lease).
- Approval-required methods run only after the approval port resolves.
- Edge-dispatched families inherit the governed runtime (ungrantable deny,
  mandate authorization, commit/abort) — the wallet cannot bypass it.
- Provider/Axia paths never receive key material.
- Method handlers normalize errors to the connect error shape; no secrets in
  errors or logs.

## 10. Dependency graph

```text
wallets → connect (constants/types) + connect/wallet (shared runtime)
wallets → statechain, kissvm, chain-provider (RFC-013), wots-lease, storage
connect/wallet → (no concrete runtime deps; structural ports only, cycle-free)
hosts that run autonomy → edge, agent-policy   (not the wallets)
```

`@totemsdk/connect` stays dApp-focused; if a `connect/wallet` subpath is added it
must not import the wallets.

## 11. Phases

- **P0** — this RFC; freeze the method disposition table (§6.3).
- **P1** — T1: `@totemsdk/connect` dep + shared method registry + conformance test.
- **P2** — shared `connect/wallet` runtime (or `wallet-runtime`) + local families;
  extension adopts it (closes T2 local set + lowercase namespace).
- **P3** — execution families via **approval-gated SDK/chain calls** (Omnia/
  payments; then statechain/kissvm); the injected `edge` port exists but is
  supplied only by hosts that run an autonomous runtime, never built in the
  wallet (T4, §6.4).
- **P4** — capability manifest + `totem_getCapabilities`/status parity (T5 §6.1).
- **P5** — PWA parity: adopt the shared runtime + add extension's non-connect
  surface (T3).
- **P6** — receipt/status persistence, approval-page parity, docs; `KNOWN_GAPS`
  → empty; gate green.

## 12. Resolved decisions

- One shared wallet handler implementation; no per-wallet duplication.
- `@totemsdk/connect` is the source of truth for methods/types.
- The wallet is a **consent + signing surface**, not an autonomous executor.
  Execution families are **approval-gated SDK/chain calls** by default; the
  governed Edge runtime (mandate-bound autonomy) is **not constructed in the
  wallet** and is supplied via the injected `edge` port only by hosts that run
  autonomous agents/devices (§6.4).
- One capability manifest drives `getCapabilities` and the gate.
- The extension's non-connect surface is brought into the shared runtime (PWA
  parity by construction).

## 13. Open questions — resolved for v1

- **Q1** Placement → **`@totemsdk/connect/wallet` subpath**. No new top-level
  package; the wallet-side counterpart to the dApp client. It must not import the
  wallets.
- **Q2** tx status/receipts → **persist in-wallet** via an injected
  `ReceiptStorePort`; Axia endpoints stay RFC-015. When no store is wired the
  method is explicitly `unsupported` (reason), never a silent stub.
- **Q3** Omnia/payments/statechain/kissvm/agent → **consent-gated SDK/chain
  calls** over injected clients (model B), *not* a wallet-hosted governed
  runtime. The `edge` dispatch port stays part of the context as an **optional,
  host-supplied** seam for autonomous runtimes; a browser wallet does not wire
  it. `@totemsdk/connect/wallet` depends on **none** of these concretely — it
  defines structural ports and stays cycle-free.
- **Q4** streaming/snapshot surface → **not required for PWA parity in v1**; those
  remain local wallet handlers. Only connect methods are gated.

### 13.1 Additional resolved decisions

- The method registry is derived from a canonical `CONNECT_METHODS` array
  introduced in `@totemsdk/connect/wallet` (none existed in `connect`).
- `createWalletRuntime(handlers?, ctx)` returns a `TotemProvider`-compatible
  object; each method resolves to `handled` or `unsupported` (with a reason) from
  the shared manifest — the wallet never silently ignores a method.
- The parity audit becomes **runtime-aware**: a wallet that creates the shared
  runtime is scored from its served manifest, not from hand-scraped `case`
  strings.
- **Consent vs autonomy (locked):** mandate-bound governance
  (`GrantBoundAutonomyPolicy`) lives in autonomous runtimes
  (`@totemsdk/edge` agent/industrial, `se-server`), not in the browser wallets.
  The wallets expose an approval port; an autonomous agent uses the wallet as its
  signer/approver through connect, keeping authority and consent separated.

## 14. References

- `docs/audits/wallet-connect-parity-2026-09.md` (T1–T5), `scripts/audit-wallet-connect-parity.mjs`
- `packages/connect/src/{index,types}.ts`
- `packages/edge/src/{action-registry,agent-runtime,ports,actions}.ts`
- `packages/statechain`, `packages/kissvm`, `packages/agent-policy`, `packages/omnia`
- `extensions/totem-extension/src/background/index.ts`
- `extensions/totem-pwa-wallet/src/provider/provider-entry.ts`
- RFC-008, RFC-010, RFC-013
