# Omnia LSP

**Status:** Draft — Phase 0/1 partial. The `@totemsdk/omnia-lsp` manifest/quote/ranking primitives, `@totemsdk/omnia-lsp-provider` policy/quote/host adapter, the wallet-side funding-witness port, the Omnia lease path and MOKA's open-capacity flow are implemented. Omnia defaults to durable local lease storage; `OMNIA_AXIA_LEASE=true` opts into the Axia hardened lease adapter. The provider-funded LSP host e2e (open → pay → settle → close across two hosts) now passes; the remaining Phase 1 gates are live-Axia verification of the opt-in lease/coinproof path and the consumer extension wallet ↔ provider host e2e.
**Canonical RFC:** [RFC-081 — Omnia LSP](../rfc/RFC-081-OMNIA-LSP.md)

Omnia LSP (Liquidity Service Provider) is the capacity and onboarding layer for
Omnia. It lets a wallet, dApp, merchant or agent discover a provider, agree
capacity terms, open or lease a channel, and exit safely — without first finding
a counterparty by hand.

This directory holds the protocol artifacts that sit beside RFC-081:

| Artifact | Purpose |
|---|---|
| [RFC-081](../rfc/RFC-081-OMNIA-LSP.md) | Problem, decision, architecture, threat model, phases |
| [manifest.schema.json](manifest.schema.json) | Provider manifest payload schema (`omnia-lsp/v1`) |
| `protocol.md` | Wire messages and state machines (Phase 0) |
| `registry.md` | Registry and ranking rules (Phase 0) |
| `jit.md` | JIT/submarine profile (Phase 3) |
| `threat-model.md` | Expanded threat model (Phase 0) |
| `conformance.md` | Test vectors and acceptance gates (Phase 0) |

## Principles

1. **Non-custodial.** The consumer keeps their keys. A provider can co-sign and
   route, but cannot move the consumer's funds alone.
2. **Wallet-built funding witness.** The wallet builds and signs the funding
   witness. A dApp or provider MUST NOT supply it.
3. **Signed manifests.** Providers publish signed, expiring terms bound to their
   identity and channel keys.
4. **Deterministic ranking.** Provider selection is inspectable and policy-based.
   No pay-to-rank.
5. **Curated first, open later.** Start with a launch provider and a curated
   registry; open registration after open/pay/close works end-to-end.
6. **Non-custodial is not trustless.** Counterparty, liveness and privacy risks
   are disclosed and mitigated with exit paths and watchtowers.
7. **Open protocol, commercial operations.** The spec, SDK and reference provider
   are Apache-2.0. Hosted liquidity, risk and operations are commercial.

## Package plan

| Package | Role |
|---|---|
| `@totemsdk/omnia-lsp` | Manifest, ranking, quotes, open/lease/JIT state machines, client interfaces |
| `@totemsdk/omnia-lsp-provider` | Reference provider/host on `omnia-host` |
| `@totemsdk/connect` | Wallet `omniaOpenChannel` and provider quote types |
| `@totemsdk/manifest` | Signed provider announcements |
| `@totemsdk/provider-bond` | Identity, bond, probes, incidents, score |
| `@totemsdk/liquidity-bond` | LP positions and fee accounting |

## Non-goals

Custody, fiat on-ramp, AMM/order book, cross-chain bridges, and a production claim
before the SDK's release gates. Factories and SE servers are not channel-vending
machines; see RFC-081 §1 and §16.
