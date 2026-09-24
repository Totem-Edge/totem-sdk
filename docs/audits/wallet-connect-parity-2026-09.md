# Wallet ⇄ connect parity audit — Totem Extension & Totem PWA

**Date:** 2026-09-24
**Scope:** `extensions/totem-extension`, `extensions/totem-pwa-wallet`, against `@totemsdk/connect`
**Machine check:** `node scripts/audit-wallet-connect-parity.mjs [--check]`

> Automated: the table below is generated. Run the script for the live matrix; `--check`
> fails when a connect method is added that a wallet neither serves nor has triaged.

---

## 1. Summary

`@totemsdk/connect` publishes **46 dApp-facing methods**. Neither wallet imports
`@totemsdk/connect` at runtime; both re-implement the wire protocol by
hand-maintained string tables, so coverage has drifted.

- **Extension: 11 / 46 handled** (35 missing). It serves only the classic set +
  tx-permission methods, and only recognises the **uppercase** `TOTEM_*` verbs.
- **PWA: 19 / 46 handled** (27 stub/missing). It is **ahead of the extension** on
  the connect surface but stubs the same large families.

The classic set and tx-permission methods are covered by **both**. The entire
**Omnia, Statechain, KISSVM, Agent, payment-request, mining, and receipt/
transaction-status** families are covered by **neither**.

## 2. Parity matrix (as of 2026-09-24)

| connect method | extension | pwa |
|---|---|---|
| `TOTEM_BROADCAST_HEX` | handled | handled |
| `TOTEM_CONNECT` | handled | handled |
| `TOTEM_GET_ACCOUNTS` | handled | handled |
| `TOTEM_GET_COINS` | handled | handled |
| `TOTEM_GET_TX_PERMISSIONS` | handled | handled |
| `TOTEM_GRANT_TX_PERMISSION` | handled | handled |
| `TOTEM_REVOKE_TX_PERMISSION` | handled | handled |
| `TOTEM_SEND_COMPLEX` | handled | handled |
| `TOTEM_SEND_TRANSACTION` | handled | handled |
| `TOTEM_SIGN_DATA` | handled | handled |
| `TOTEM_VERIFY` | handled | handled |
| `totem_getCapabilities` | missing | handled |
| `totem_getProviderStatus` | missing | handled |
| `totem_getWotsStatus` | missing | handled |
| `totem_reserveWotsLease` | missing | handled |
| `totem_releaseWotsLease` | missing | handled |
| `totem_setChainProvider` | missing | handled |
| `totem_signTransaction` | missing | handled |
| `totem_broadcastTxPoW` | missing | handled |
| `totem_mineTxPoW` | missing | stub |
| `totem_createPaymentRequest` | missing | stub |
| `totem_payPaymentRequest` | missing | stub |
| `totem_getTransactionStatus` | missing | stub |
| `totem_getReceipt` | missing | stub |
| `totem_omnia*` (13) | missing | stub |
| `totem_statechain*` (4) | missing | stub |
| `totem_kissvm*` (2) | missing | stub |
| `totem_agent*` (3) | missing | stub |

Totals: extension **11 handled / 35 missing**; PWA **19 handled / 27 stub+missing**.

## 3. Parity analysis (PWA ↔ extension)

The two wallets are **complementary, not at parity**:

| Capability | Extension | PWA |
|---|---|---|
| Classic connect set + tx permissions | ✅ | ✅ |
| Status/capabilities (`getCapabilities`/`getProviderStatus`/`getWotsStatus`) | ❌ | ✅ |
| WOTS lease reserve/release | ❌ | ✅ |
| `signTransaction` / `broadcastTxPoW` (lowercase namespace) | ❌ | ✅ |
| `setChainProvider` | ❌ | ✅ |
| Internal `RPC_COMMAND` / `START_STREAM` / `STOP_STREAM` | ✅ | ❌ |
| Portfolio/balance snapshots | ✅ | ❌ |
| Connected-site management + `GET_RPC_ENDPOINT` | ✅ | ❌ |
| Internal `WOTS_SEND` / `WOTS_SIGN_DATA` | ✅ | ❌ |
| Omnia / Statechain / KISSVM / Agent / payments / mining | ❌ | ❌ |

Conclusions:

1. **PWA is ahead on the dApp connect surface**; extension is ahead on
   non-connect runtime features (streams, snapshots, site management).
2. **The extension cannot serve the newer transaction types at all** — it is the
   primary gap for the "extension must support new connect methods" requirement.
3. **Neither wallet is complete**; the Omnia/Statechain/KISSVM/Agent families are
   unimplemented everywhere.

## 4. Structural / dependency gaps

- Neither wallet depends on `@totemsdk/omnia`, `@totemsdk/statechain`,
  `@totemsdk/kissvm`, `@totemsdk/agent-policy`, or `@totemsdk/edge`. Native
  implementation would be large; the correct route is **dispatch via the Edge
  runtime/provider** (the RFC-010/012 pattern), not embedding packages.
- Neither imports `@totemsdk/connect`'s method/type constants — the hand tables
  are the root cause of drift.
- The extension dispatches only uppercase `TOTEM_*`; the newer `totem_*` namespace
  is invisible to it.
- PWA `provider-entry.ts` lists `totem_setChainProvider` in `unsupportedMethods`
  while also handling it inline (dead entry).

## 5. Task list

### T1 — Single source of truth (both wallets)
- [ ] Add `@totemsdk/connect` as a real dependency of both wallets.
- [ ] Replace hand-maintained method tables with shared method/type constants.
- [ ] Adopt `scripts/audit-wallet-connect-parity.mjs --check` in CI.
- [ ] Add a wallet conformance test: every connect method is handled, or
      explicitly listed as unsupported with a reason.

### T2 — Extension: achieve connect parity
- [ ] Add the lowercase `totem_*` dispatch namespace.
- [ ] Implement status/capabilities: `totem_getCapabilities`,
      `totem_getProviderStatus`, `totem_getWotsStatus`,
      `totem_getTransactionStatus`, `totem_getReceipt`.
- [ ] Implement `totem_reserveWotsLease` / `totem_releaseWotsLease`.
- [ ] Implement `totem_setChainProvider`, `totem_signTransaction`,
      `totem_broadcastTxPoW`, `totem_mineTxPoW`.
- [ ] Implement `totem_createPaymentRequest` / `totem_payPaymentRequest`.
- [ ] Route Omnia (13), Statechain (4), KISSVM (2), Agent (3) via the Edge
      runtime/provider (see T4).
- [ ] Port the PWA approval-page model for the newer families.

### T3 — PWA: achieve extension parity
- [ ] Add `RPC_COMMAND`, `START_STREAM`/`STOP_STREAM`, portfolio/balance
      snapshots, connected-site management, `GET_RPC_ENDPOINT`.
- [ ] Add `WOTS_SEND` / `WOTS_SIGN_DATA` equivalents.
- [ ] Remove dead `totem_setChainProvider` entry from `unsupportedMethods`.
- [ ] Route the stubbed Omnia/Statechain/KISSVM/Agent/payment families (T4).

### T4 — Shared execution bridge (both wallets)
- [ ] Define a wallet→Edge dispatch contract for Omnia/Statechain/KISSVM/Agent so
      both wallets share one implementation instead of duplicating.
- [ ] Decide per-method whether it runs locally (SDK/Edge) or via Axia RPC (T5).

### T5 — Axia API alignment (see §6)
- [ ] Extend the SE registry to the RFC-008 identity/federation shape.
- [ ] Update the WOTS lease API to the `wots-lease` v3 / `root-identity` model.
- [ ] Add wallet capability/method-support discovery.
- [ ] Add transaction-status + receipt endpoints (or declare wallets-local).
- [ ] Add decision/industrial compute to quota + telemetry.

## 6. Axia API recommendations

Axia (`api.axia.to` / `api.axia.network`) is the hosted RPC/lease/quota/registry
service the extension already depends on: `/v1/wots-hardened/*`,
`/v1/wallet/*`, `/v1/portfolio`, `/v1/status/block`, `/v1/telemetry`,
`/public/se-registry`, `/public/minima/burn-stats`. For the wallets to reach the
proposed parity, Axia needs the following.

### 6.1 Wallet capability / method-support discovery (new)
Both wallets currently hardcode which methods they support. Axia should expose
the authoritative **support manifest** and version it:
- `GET /public/wallet-capabilities` → `{ wallet, version, methods: { [method]: 'supported' | 'unsupported' }, capabilities: string[] }`
- Keep `totem_getCapabilities` a thin read of this, so extension and PWA cannot
  disagree. This directly fixes the drift class found in this audit.

### 6.2 SE registry → RFC-008 shape (extend)
`public/se-registry` (`SERegistryEntry`: `sePublicKey`, `url`, `name`,
`feeBasisPoints`, `chainCount`, `verified`, `axiaHosted`, `announcedAt`,
`expiresAt`) must carry the new identity model:
- per-member identity `{ rootPublicKey, proofVersion, ownershipProof }`
  (RFC-008 §5.8), not just a flat `sePublicKey`;
- a **federation descriptor** `{ members[], threshold }`;
- bond reference and a machine-checkable `proofNonce`/`proofSignature` announce;
- revocation/equivocation epochs (RFC-008 §7).

### 6.3 WOTS lease API → leased-leaf model (update)
The documented `/v1/wots-hardened/prepare|finalize|watermark|coinproofs` and the
"per-address TreeKey, 3-proof chain" flow predate the SDK's current model
(`@totemsdk/wots-lease` v3 watermark + journal, `@totemsdk/root-identity`
leased root/child leaves, RFC-008/009 TreeKey owner + witness). Axia must:
- lease **root and child leaves** with a durable watermark and burn-on-failure;
- return the RFC-008 envelope (leaf identity + proof version), not a bare index;
- accept the Minima-faithful witness (`SignatureProof`) on finalize;
- expose equivocation/revocation status for federation.

### 6.4 New families: route or declare out-of-scope (decide)
Omnia/Statechain/KISSVM/Agent are not represented on Axia today. Two viable
models — pick one and document it:
- **(A) Axia as relay:** add `/v1/omnia/*`, `/v1/statechain/*`, `/v1/kissvm/*`,
  `/v1/agent/*` (mirroring connect names) so wallets stay thin; or
- **(B) Wallets as SDK clients:** wallets call `@totemsdk/*` / Edge directly and
  Axia is only RPC/lease/quota. Recommended for Omnia/Statechain (they are
  client-side constructs) — avoids Axia becoming a god-service.
Either way, the decision must live in one place and be reflected in the support
manifest (§6.1).

### 6.5 Transaction status + receipts (add or delegate)
`totem_getTransactionStatus` / `totem_getReceipt` are stubbed. Axia should expose
a canonical source of truth — `GET /v1/transactions/:txpowid` and
`GET /v1/receipts/:receiptId` — with stable fields, or the wallets must persist
locally. Do not leave both stubbed.

### 6.6 Quota / credits + telemetry (extend)
Add method credit weights for the new families (decision compute per RFC-012,
industrial actions, omnia/statechain ops), and extend `/v1/telemetry` to record
the chosen decision/action **as metadata only** (proposal vs executed), so
operator dashboards can distinguish inference, decision, and execution.

## 7. Acceptance / verification

- `node scripts/audit-wallet-connect-parity.mjs --check` green in CI.
- Zero `missing` connect methods per wallet (stubs allowed only with an explicit
  `unsupported` reason sourced from the support manifest).
- Extension and PWA both advertise the same capability set from one source.
- New connect method added → `--check` fails until triaged (anti-drift).
- No wallet holds signing keys for provider/Axia paths (Totem invariant).

## 8. References

- `packages/connect/src/index.ts`, `packages/connect/src/types.ts`
- `extensions/totem-extension/src/background/index.ts`, `.../provider.ts`
- `extensions/totem-pwa-wallet/src/provider/provider-entry.ts`
- `packages/statechain/src/registry.ts` (`SERegistryEntry`)
- RFC-008 (federated statechain / SE registry), RFC-009 (witness fidelity),
  RFC-010, RFC-011, RFC-012
- `docs/totem-agent/01-architecture.md` (documented Axia lease/bootstrap flow)
