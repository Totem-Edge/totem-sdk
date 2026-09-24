# RFC-015: Axia API Alignment — Wallet Capability, SE Registry, Lease, Status & Metering

**Status:** Draft — not started
**Created:** 2026-09-24
**Authors:** Totem SDK Contributors
**Reviewers:** [Pending stakeholder assignment]
**Depends on:** RFC-008 (federated statechain / SE registry), RFC-013 (wallet self-hosted mode), RFC-014 (wallet connect parity)
**Touches:** external Axia service contract; `packages/statechain` (`SERegistryEntry`); wallets' Axia clients

---

## 1. Summary

Axia (`api.axia.to` / `api.axia.network`) is the hosted relay, WOTS-lease, SE
registry, quota, and telemetry service the extension already depends on. The
wallet work in RFC-013 and RFC-014 exposes gaps on the Axia side. This RFC defines
the **Axia API contract changes** needed for the wallets, dApps, and the SDK to
agree — without Axia becoming a god-service. It owns audit items **T5 §6.1/§6.2/
§6.5/§6.6** and clarifies §6.3 (lease model) alongside RFC-013.

## 2. Motivation

- Both wallets hardcode the connect method surface; Axia has no authoritative
  **capability/method-support** document, so extension and PWA drift (audit).
- The SE registry entry (`packages/statechain/src/registry.ts` `SERegistryEntry`:
  `sePublicKey`, `url`, `name`, `feeBasisPoints`, `chainCount`, `verified`,
  `axiaHosted`, `announcedAt`, `expiresAt`) predates RFC-008's root-identity /
  federation model.
- `totem_getTransactionStatus` / `totem_getReceipt` are stubbed with no canonical
  source of truth.
- Quota/telemetry weights cover today's calls but not the decision/industrial/
  Omnia/Statechain families the wallets will route.

## 3. Scope

In scope: the Axia **HTTP contract** the SDK/wallets depend on, with a
repo-side **contract test** (mock server) so changes are caught. Out of scope:
Axia's internal implementation, pricing policy, and anything not consumed by the
SDK/wallets.

## 4. Current Axia surface consumed by wallets

- Lease: `/v1/wots-hardened/prepare`, `/finalize`, `/finalize-mined`,
  `/watermark`, `/coinproofs`, `/debug/export`.
- Chain/wallet: `/v1/wallet/{coins,tokens,transactions,txpow-params}`,
  `/v1/portfolio/:address`, `/v1/status/block`, `/v1/wallet/balance/ws`.
- Ops: `/v1/telemetry`, `/v1/events/ws`, `/v1/tlm/token`, `/v1/wallet/ws-token`.
- Public: `/public/se-registry` (+ `/announce`), `/public/minima/burn-stats`.

## 5. Required changes

### 5.1 Wallet capability / method-support manifest (T5 §6.1)

Add `GET /public/wallet-capabilities?wallet=&version=` returning the manifest
defined in RFC-014 §6.5:

```json
{
  "wallet": "totem-extension",
  "version": "x.y.z",
  "methods": { "TOTEM_CONNECT": "supported", "totem_omniaPay": "unsupported" },
  "capabilities": ["decision:action", "intelligence:llm"],
  "reasons": { "totem_omniaPay": "requires off-chain Omnia" }
}
```

`totem_getCapabilities` / `totem_getProviderStatus` read this (or the wallet's
local mirror when self-hosted). This is the single source that keeps extension
and PWA consistent and feeds the anti-drift gate.

### 5.2 SE registry → RFC-008 shape (T5 §6.2)

Extend `/public/se-registry` entries and `/announce`:

- per-member identity `{ rootPublicKey, proofVersion, ownershipProof }` (RFC-008;
  not a flat `sePublicKey`);
- **federation descriptor** `{ members[], threshold }`;
- `bondRef` and a machine-checkable `proofNonce` / `proofSignature` announce;
- `revocationEpochs` / equivocation status (RFC-008 §7);
- retain `feeBasisPoints`, `url`, `name`, `verified`, `axiaHosted`, 7-day TTL.

Update `packages/statechain/src/registry.ts` `SERegistryEntry` to match, with a
back-compat read (flat → singleton member).

### 5.3 WOTS lease model (T5 §6.3, relates to RFC-013)

Axia's `/v1/wots-hardened/*` predates `@totemsdk/wots-lease` v3 +
`@totemsdk/root-identity` and the RFC-009 TreeKey witness. Align:

- lease **root and child leaves** (not a bare flat index) with a durable
  watermark and burn-on-failure;
- return the RFC-008 envelope (leaf identity + proof version);
- accept the Minima-faithful witness (`SignatureProof`) on finalize;
- expose watermark read/publish so a self-hosted wallet (RFC-013) can reconcile
  its local record with Axia's when the user is online.

Axia is the **default** lease authority; RFC-013 lets users opt out. When both
exist, define the reconciliation rule (on-chain cursor wins; §RFC-013 §9).

### 5.4 Transaction status + receipts (T5 §6.5)

Provide a canonical source of truth so the stubs can be implemented:

- `GET /v1/transactions/:txpowid` → status (`pending|confirmed|failed`), block,
  confirming txpowid, broadcast time (idempotent).
- `GET /v1/receipts/:receiptId` → the receipt record (inference/decision/action).
- Or declare wallets-local: if Axia does not expose these, the wallets persist
  locally and the methods are marked `supported` via local state — but **not**
  left stubbed. Pick one; RFC-014 §13 Q2 decides wallet-side.

### 5.5 Quota / credits + telemetry (T5 §6.6)

- Add method credit weights for the new families: Omnia ops, statechain
  claim/transfer, KISSVM simulate/validate, agent intents, decision compute
  (RFC-012), industrial actions.
- Extend `/v1/telemetry` to record the **chosen decision/action as metadata
  only** (proposal vs executed), so dashboards distinguish inference, decision,
  authorization, and execution — never conflate confidence with authority.
- Keep `X-Quota-*` headers; document per-method weights.

### 5.6 Versioning / feature flags

Extend the existing `admin/feature-flags/sdk-migration` mechanism to advertise
wallet method support + SDK rollouts, so wallets gate on advertised capabilities
rather than hardcoded tables. Version the capability manifest.

## 6. Security & privacy

- No key material to Axia on any endpoint; the lease endpoints coordinate slots,
  they do not receive seeds/signatures-before-broadcast beyond today's flow.
- `Authorization`/API keys never logged; telemetry carries no secrets.
- SE registry entries are verifiable (root proof + signature), not trusted
  blindly.
- Self-hosted mode must not silently fall back to Axia (RFC-013 §11); the
  capability manifest reflects the user's chosen mode.

## 7. Compatibility & rollout

- Additive where possible; SE-registry shape ships with a flat→singleton
  back-compat reader; lease changes gated by version negotiation.
- Contract tests: a mock Axia server in-repo asserting each endpoint shape the
  SDK/wallets depend on; fail CI on drift.

## 8. Phases

- **P0** — this RFC; freeze the contract.
- **P1** — wallet capability manifest endpoint + wallet adoption (RFC-014 §6.5).
- **P2** — SE registry RFC-008 shape + `SERegistryEntry` update + back-compat.
- **P3** — lease model alignment (+ RFC-013 reconciliation).
- **P4** — transaction status / receipts decision + implementation.
- **P5** — quota weights + telemetry for the new families.
- **P6** — contract tests + docs.

## 9. Resolved decisions

- Axia stays the default relay/lease/registry/metering service (RFC-013).
- One capability manifest defines wallet method support.
- SE registry adopts the RFC-008 identity/federation shape with back-compat.
- receipts/status must have one authoritative source, not dual stubs.
- Telemetry never conflates decision/confidence with authority.

## 10. Open questions

- **Q1** Is Axia the source of truth for transaction status/receipts, or do
  wallets persist locally (RFC-014 Q2)?
- **Q2** Federated SE fee/bond model — one fee per federation or per member?
- **Q3** Do decision/industrial compute calls bill through Axia quota, or a
  separate metering path?
- **Q4** Capability manifest ownership: Axia-served vs wallet-served-with-Axia-mirror?

## 11. References

- `docs/audits/wallet-connect-parity-2026-09.md` §6
- RFC-008 (SE registry/federation), RFC-009 (witness), RFC-012 (decision), RFC-013 (self-hosted), RFC-014 (connect parity)
- `packages/statechain/src/registry.ts` (`SERegistryEntry`)
- `packages/wots-lease/src/{local,axia,hybrid}.ts`
- `docs/totem-agent/01-architecture.md`
