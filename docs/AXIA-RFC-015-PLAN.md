# RFC-015 Execution Plan — Axia API Contract Ownership & Phasing

**Status:** Plan — approved, not started
**Created:** 2026-10-01
**Related:** RFC-015 (SDK consumer spec), RFC-008, RFC-009, RFC-013, RFC-014
**Repos:** `axia-platform` (contract owner), `totem-sdk` (consumer)

---

## 1. Decision

The Axia API contract is owned by **`axia-platform`**, not `totem-sdk`.

- **Contract owner:** `axia-platform/docs/rfcs/RFC-0002-API-CONTRACT.md` (RFC-0001 is the only existing Axia RFC).
- **Consumer spec:** `totem-sdk/docs/rfc/RFC-015-AXIA-API-ALIGNMENT.md` is reduced to the SDK/wallet-side obligations and **references** RFC-0002. It stops defining endpoint JSON.
- **Machine-readable single source:** an `@axia/contracts` package in `axia-platform` (Zod schemas + JSON fixtures + mock server). SDK contract tests import it, so drift fails CI in both repos against one source.

## 2. What is already satisfied (do not redo)

RFC-013 (self-hosted mode) and RFC-014 (wallet connect parity) are **Landed**.

- `totem_getTransactionStatus` / `totem_getReceipt` are served from a **persisted wallet-local receipt store** (RFC-014), not stubs.
- `buildWalletCapabilityManifest` already exists in `@totemsdk/connect/wallet`; both wallets report 46/46 served.

Therefore RFC-015 §5.4 becomes “record the wallet-local decision”, and §5.1 becomes “serve the manifest for discovery”, not “invent the method surface”.

## 3. Gating

§5.2 (SE registry RFC-008 shape) and §5.3 (WOTS lease alignment) depend on **RFC-008 and RFC-009, both still Draft**. Changing Axia's SE/lease shape before they land would reopen those RFCs. Deferred accordingly.

## 4. Phased plan

| Phase | Deliverable | Repo | Gate |
|---|---|---|---|
| **P0** | Axia RFC-0002 skeleton + `@axia/contracts` (schemas/fixtures/mock) for the **existing** surface only (lease, chain, ops, public) — a frozen baseline | axia-platform | none |
| **P1** | `GET /public/wallet-capabilities` endpoint consuming the RFC-014 manifest shape | axia-platform | none |
| **P2** | SDK + wallet contract tests importing `@axia/contracts`; wire the RFC-014 anti-drift gate | totem-sdk | P0, P1 |
| **P3** | Quota method weights for decision/industrial/omnia/statechain + telemetry decision-vs-authority separation | axia-platform | P0 |
| **P4** | Amend RFC-0002 + RFC-015 to record wallet-local receipts/status as authoritative; add `/v1/transactions/:txpowid` only if Axia is later made canonical | both | decision |
| **P5** | SE registry → RFC-008 shape + `SERegistryEntry` back-compat read | both | **RFC-008 landed** |
| **P6** | WOTS lease alignment (root/child leaves, RFC-008 envelope, TreeKey witness, watermark reconciliation) | both | **RFC-008 + RFC-009 landed** |

P0–P3 are additive and unblocked. P5/P6 are gated.

## 5. Repo / branch mechanics

- `axia-platform` is on `fix/integration-suites` with a clean tree. New work branches from `origin/main` (e.g. `rfc-0002-api-contract`), one PR per phase — not off the in-progress branch.
- A matching `totem-sdk` PR occurs only where SDK code changes (P2, P5, P6).
- Diffs are shown before committing in `axia-platform`, despite standing permission to commit.

## 6. Risks

| Risk | Mitigation |
|---|---|
| Cross-repo version skew | `@axia/contracts` is the single source; both CI suites import it |
| RFC-008/009 drift | P5/P6 deferred; P0 freezes only today's shapes |
| Duplicated contract JSON diverging | RFC-0002 owns the contract; RFC-015 rewritten as a consumer pointer |
| `/api/feature-flags` vs a public `/v1` path | Pin the public path in RFC-0002 before SDK adoption |

## 7. Current status of RFC-015 items in `axia-platform`

| RFC-015 item | State |
|---|---|
| §5.1 wallet-capabilities | Absent |
| §5.2 SE registry RFC-008 shape | Old flat shape (`statechain/seRegistryRoutes.ts`) |
| §5.3 WOTS lease alignment | Router exists (`/v1/wots-hardened`); needs audit vs `@totemsdk/wots-lease` v3 |
| §5.4 status/receipts | Wallet-local (RFC-014); Axia endpoints absent |
| §5.5 quota weights | `credits/methodWeights.ts` exists; no new-family weights |
| §5.6 feature flags | `/api/feature-flags` exists; no capability manifest |
| §7 contract test | None in either repo |

## 8. Immediate next step

**P0 only:** draft `axia-platform/docs/rfcs/RFC-0002-API-CONTRACT.md` + the `@axia/contracts` baseline for the existing endpoints. No new behaviour, no SDK edits.
