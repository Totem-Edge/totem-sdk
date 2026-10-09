# RFC-015 Execution Plan — Axia API Contract Ownership & Phasing

**Status:** In progress — **P0 + P1 landed** (on `axia-platform` `feat/omnia-sdk-1.0`, awaiting merge to `main`); **P2 started**; P3–P6 outstanding.
**Created:** 2026-10-01
**Updated:** 2026-10-08
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

| Phase | Deliverable | Repo | Gate | State |
|---|---|---|---|---|
| **P0** | Axia RFC-0002 skeleton + `@axia/contracts` (schemas/fixtures/mock) for the **existing** surface only (lease, chain, ops, public) — a frozen baseline | axia-platform | none | **Landed** (`653f959`) |
| **P1** | `GET /public/wallet-capabilities` endpoint consuming the RFC-014 manifest shape (+ `x-admin-key` mirror `POST`) | axia-platform | none | **Landed** (`75df96c`) |
| **P2** | SDK + wallet contract tests importing `@axia/contracts`; wire the RFC-014 anti-drift gate | totem-sdk | P0, P1 | **In progress** (contract client + tests landed) |
| **P3** | Quota method weights for decision/industrial/omnia/statechain + telemetry decision-vs-authority separation | axia-platform | P0 | Not started |
| **P4** | Amend RFC-0002 + RFC-015 to record wallet-local receipts/status as authoritative; add `/v1/transactions/:txpowid` only if Axia is later made canonical | both | decision | Not started |
| **P5** | SE registry → RFC-008 shape + `SERegistryEntry` back-compat read | both | **RFC-008 landed** | Blocked |
| **P6** | WOTS lease alignment (root/child leaves, RFC-008 envelope, TreeKey witness, watermark reconciliation) | both | **RFC-008 + RFC-009 landed** | Blocked |

P0–P2 are additive and unblocked. P3 is unblocked but not started. P4 is now actionable
(RFC-014 landed). P5/P6 are gated on RFC-008/RFC-009.

### 4.1 P0/P1 evidence (axia-platform)

- `docs/rfcs/RFC-0002-API-CONTRACT.md` — contract baseline (rev 1, Draft).
- `packages/contracts/` — `@axia/contracts` (Zod schemas, fixtures, mock server, unit tests). **Not yet published to npm**; consumers currently resolve it by workspace/path.
- `packages/axia-api/src/walletCapabilities/{routes,store}.ts`, registered at `packages/axia-api/src/routes/api.ts:230`.

Both commits live on branch `feat/omnia-sdk-1.0`; `origin/main` stops at `144cc80`, so P0/P1 must be merged before consumer CI can rely on them.

### 4.2 Known constraint for P2

`@axia/contracts` pins Zod 3 while `totem-sdk` resolves Zod 4, and the package is
unpublished. P2 therefore has two viable wiring options:

- **(a) Published package** — publish `@axia/contracts` (or pull it in as a git
  dependency) and import its schemas directly from `totem-sdk` CI.
- **(b) Vendored bridge** — copy the P0 schema shapes into `totem-sdk` as a test
  fixture and add a drift assertion that compares them to the contract; this works
  offline today but is a weaker single-source guarantee.

The P2 increment landed here uses **(b)** and is written so it can be upgraded to
**(a)** without changing test intent.

### 4.3 P2 status

- **Landed (`totem-sdk`):** `@totemsdk/connect/axia-contract` — publish (admin
  mirror), fetch/validate, and manifest-diff client over the RFC-0002 §4.2a
  surface; plus `packages/connect/src/__tests__/axia-contract.test.ts` consuming
  the mirrored P0 `wallet-capabilities` fixture (`walletCapabilitiesUrl`,
  `isWalletCapabilityManifest`, `fetchAxiaWalletCapabilities`,
  `publishAxiaWalletCapabilities`, `diffWalletCapabilityManifests`).
- **Remaining for P2:** have the wallets publish their `sharedConnectManifest()`
  to Axia on change (they are the source of truth); extend the contract tests to
  the remaining P0 surface (WOTS lease, SE registry, operational) once the wiring
  option (a/b) is decided; and make the anti-drift gate assert against the
  contract rather than only the parity matrix.

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
| §5.1 wallet-capabilities | **Endpoint landed** (`GET`/`POST /public/wallet-capabilities`, RFC-0002 P1) |
| §5.2 SE registry RFC-008 shape | Old flat shape (`statechain/seRegistryRoutes.ts`); gated on RFC-008 (P5) |
| §5.3 WOTS lease alignment | Router exists (`/v1/wots-hardened`); needs audit vs `@totemsdk/wots-lease` v3; gated (P6) |
| §5.4 status/receipts | Wallet-local (RFC-014); Axia endpoints absent (P4) |
| §5.5 quota weights | `credits/methodWeights.ts` exists; **no** decision/industrial/kissvm/agent weights; telemetry is a bare `202` stub (P3) |
| §5.6 feature flags | `/api/feature-flags` exists; capability manifest now served separately (P1); wallet gating on it not yet wired |
| §7 contract test | `@axia/contracts` unit tests exist; **no** consumer (SDK) contract test yet (P2) |

## 8. Immediate next step

**P2:** consume the P0/P1 contract from `totem-sdk` — contract tests over the
`@axia/contracts` shapes (lease, registry, wallet-capabilities, operational), the
wallet reading `/public/wallet-capabilities`, and an anti-drift gate. Then **P3**
(quota weights + telemetry separation) on `axia-platform`.

Prerequisite: merge P0/P1 (`feat/omnia-sdk-1.0`) to `axia-platform main` and decide
P2 wiring option (a) published package vs (b) vendored bridge (§4.2).
