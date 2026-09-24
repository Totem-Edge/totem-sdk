# Totem SDK Documentation

> Canonical index of all SDK documentation. For the public-facing documentation site, visit [totem.ing](https://totem.ing).

---

## Getting started

| Document | Description |
|----------|-------------|
| [../README.md](../README.md) | Main repo README — vision, architecture, package catalog, quick start |
| [../CHANGELOG.md](../CHANGELOG.md) | Full version history |
| [../CONTRIBUTING.md](../CONTRIBUTING.md) | Contribution guidelines and development setup |
| [../SECURITY.md](../SECURITY.md) | Security policy and vulnerability reporting |
| [../SDK_MANIFEST.json](../SDK_MANIFEST.json) | Machine-readable package index (for AI agents and tooling) |

---

## Core specifications

| Document | Description |
|----------|-------------|
| [../TOTEM_CORE_YELLOW_PAPER.md](../TOTEM_CORE_YELLOW_PAPER.md) | Core cryptographic yellow paper — WOTS+ parameters, TreeKey hierarchy, signing, serialization, lease/watermark coordination, Rust/WASM engine |
| [../TOTEM_CONNECT_RED_PAPER.md](../TOTEM_CONNECT_RED_PAPER.md) | Connect Red Paper — dApp-wallet wire protocol specification (49 methods) |
| [../TOTEM_OMNIA_BLUE_PAPER.md](../TOTEM_OMNIA_BLUE_PAPER.md) | Omnia Blue Paper — P2P payment channels, routing, factories, VTXOs, statechains, scaling to billions |
| [../TOTEM_GOVERNANCE_GREEN_PAPER.md](../TOTEM_GOVERNANCE_GREEN_PAPER.md) | Governance Green Paper — authority mandates, recursive MAST policy trees, quadratic voting, liquid democracy, QVAC agent policy |
| [../TOTEM_EDGE_GREY_PAPER.md](../TOTEM_EDGE_GREY_PAPER.md) | Edge Grey Paper — port-injected, transport-agnostic runtime, protocol adapters, MachinePay, offline operation |
| [../TOTEM_TOKENOMICS_GOLD_PAPER.md](../TOTEM_TOKENOMICS_GOLD_PAPER.md) | Tokenomics Gold Paper — two-asset model: MINIMA as collateral backbone, TOTEM as service revenue token |
| [../TOTEM_PRIVACY_NOTE.md](../TOTEM_PRIVACY_NOTE.md) | Privacy considerations for Totem SDK users |

---

## KISSVM

| Document | Location |
|----------|----------|
| **KISSVM index** | [kissvm/README.md](kissvm/README.md) |
| **Language reference** | [../packages/kissvm/docs/REFERENCE.md](../packages/kissvm/docs/REFERENCE.md) |
| **Template catalog** | [../packages/kissvm/docs/TEMPLATES.md](../packages/kissvm/docs/TEMPLATES.md) |
| **Comprehensive guide** | [../packages/kissvm/docs/KISSVM_Comprehensive_Guide.md](../packages/kissvm/docs/KISSVM_Comprehensive_Guide.md) |
| **Code gap analysis** | [../packages/kissvm/docs/GAPS.md](../packages/kissvm/docs/GAPS.md) |
| **Example scripts** | [../packages/kissvm/docs/examples/](../packages/kissvm/docs/examples/) |

---

## Totem Agent (AI-powered wallet design)

| Document | Description |
|----------|-------------|
| [totem-agent/README.md](totem-agent/README.md) | Agent overview and knowledge base structure |
| [totem-agent/01-architecture.md](totem-agent/01-architecture.md) | Extension architecture, message flows, keyring structure |
| [totem-agent/02-transaction-workflows.md](totem-agent/02-transaction-workflows.md) | 3-step WOTS signing flow, state diagrams, error handling |
| [totem-agent/03-sdk-integration.md](totem-agent/03-sdk-integration.md) | WOTS SDK, Axia API endpoints, quota management |
| [totem-agent/04-browser-requirements.md](totem-agent/04-browser-requirements.md) | Browser extension requirements and constraints |
| [totem-agent/05-design-system.md](totem-agent/05-design-system.md) | Flat Brutalist design system for the wallet UI |
| [totem-agent/06-ui-components.md](totem-agent/06-ui-components.md) | UI component specifications |
| [totem-agent/11-totem-agent-instructions.md](totem-agent/11-totem-agent-instructions.md) | Agent instruction set and behavior rules |
| [totem-agent/12-example-scenarios.md](totem-agent/12-example-scenarios.md) | Example usage scenarios and workflows |
| [totem-agent/13-quick-reference.md](totem-agent/13-quick-reference.md) | Quick reference card for common patterns |

---

## Intelligence system (local edge AI)

| Document | Description |
|----------|-------------|
| [rfc/RFC-006-SDK-INTELLIGENCE-QVAC-INTEGRATION.md](rfc/RFC-006-SDK-INTELLIGENCE-QVAC-INTEGRATION.md) | Design spec — domains, capabilities, edge gating, agent-policy inference intents (implemented, P0–P7) |
| [../packages/intelligence/README.md](../packages/intelligence/README.md) | `@totemsdk/intelligence` — provider-neutral contracts; **the AI proposes, Totem authorizes** |
| [../packages/qvac/README.md](../packages/qvac/README.md) | `@totemsdk/qvac` — QVAC adapter, discovery, per-domain adapters |
| [edge-agent-governance.md](edge-agent-governance.md) | Governed-agent coverage for `intelligence:invoke` / `intelligence:cancel` |
| [../SECURITY.md](../SECURITY.md) | Reporting + supported-version policy |

---

## Research & vision

| Document | Description |
|----------|-------------|
| [building-eefi-with-totem-edge.md](building-eefi-with-totem-edge.md) | **Building Eefi with Totem Edge** — Edge DeFi explained: how IoT devices, sensors, and machines run their own payment channels, liquidity pools, and governance on Minima. Covers Omnia eltoo channels, statechains, VTXOs, channel factories, MachinePay, provider bonds, recursive MAST, quadratic governance, QVAC agent policy, and the full Eefi stack. |
| [edge-agent-governance.md](edge-agent-governance.md) | **Edge Agent Governance** — universal action registry, governed agent facade, real-tx effect derivation, ungrantable activities, boundary escalation, receipt graphs |

---

## dApp integration

| Document | Description |
|----------|-------------|
| [totem-connect-integration-guide.md](totem-connect-integration-guide.md) | Web developer guide for integrating Totem wallet into dApps |
| [../TOTEM_CONNECT_RED_PAPER.md](../TOTEM_CONNECT_RED_PAPER.md) | Connect Red Paper — dApp-wallet wire protocol specification (49 methods, all parameters, all responses) |

---

## Package-level docs

| Package | Document |
|---------|----------|
| `@totemsdk/storage` | [Package README](../packages/storage/README.md) — storage contracts & adapters: `StorageError`, codec, `Namespace`, transaction/CAS, `ArtifactStore` + pluggable `ArtifactStoreBackend` port |
| `@totemsdk/intelligence` | [Package README](../packages/intelligence/README.md) — provider-neutral contracts for local AI inference: capabilities, operations, usage receipts, error codes, `EdgeIntelligencePort` |
| `@totemsdk/qvac` | [Package README](../packages/qvac/README.md) — QVAC adapter: runtime capability discovery, per-domain adapters, `/edge`/`/raw` subpaths |
| `@totemsdk/core` | [Integration guide](../packages/core/docs/INTEGRATION_GUIDE.md) — server-side verification, hex conventions, TreeSignature format |
| `@totemsdk/omnia` | [Package README](../packages/omnia/README.md) — eltoo channels, 8 built-in programs, Rust/WASM parity |
| `@totemsdk/authority` | [Governance boundary](../packages/authority/docs/authority-governance-boundary.md), [Governance design](../packages/authority/docs/governance-design.md) |
| `@totemsdk/edge-adapters` | [Protocol adapters plan](../packages/edge-adapters/docs/edge-protocol-adapters-plan.md) |

---

## Operations & runbooks

| Document | Description |
|----------|-------------|
| [SDK Audit (archived)](archive/SDK_AUDIT-2026-02-ARCHIVED.md) | Historical Feb 2026 package audit; superseded by the README maturity table |
| [Wallet ⇄ connect parity (2026-09)](audits/wallet-connect-parity-2026-09.md) | Extension vs PWA coverage of `@totemsdk/connect` methods; parity/task list and Axia API recommendations (`scripts/audit-wallet-connect-parity.mjs`) |
| [SDK_ROLLBACK_RUNBOOK.md](SDK_ROLLBACK_RUNBOOK.md) | Rollback procedures for SDK releases |
| [SDK_STAGED_ROLLOUT.md](SDK_STAGED_ROLLOUT.md) | Staged rollout strategy for SDK deployments |
| [RECOVERY_CLI.md](RECOVERY_CLI.md) | Recovery CLI tool documentation |
| [admins/platform/node-pool-policy.md](admins/platform/node-pool-policy.md) | Node pool policy for platform administrators |
| [admins/support/admin-escalation.md](admins/support/admin-escalation.md) | Admin escalation procedures |
| [admins/support/incident-response.md](admins/support/incident-response.md) | Incident response playbook |

---

## Engineering design docs

| Document | Description |
|----------|-------------|
| [temporal-framework-design.md](temporal-framework-design.md) | Cross-package temporal script framework design |
| [remediation-plan.md](remediation-plan.md) | Per-package line-level dead code remediation plan |
| [dead-code-inventory.md](dead-code-inventory.md) | Monorepo-wide dead code and placeholder inventory |
| [provider-bond-plan.md](provider-bond-plan.md) | Provider bond implementation plan |

---

## Security & compliance

| Document | Description |
|----------|-------------|
| [security/crypto-policy.md](security/crypto-policy.md) | Cryptographic policy and approved algorithms |
| [developers/extension/security-faq.md](developers/extension/security-faq.md) | Security FAQ for extension developers |

---

## RFCs

| Document | Description |
|----------|-------------|
| [rfc/RFC-001-SDK-UPGRADE.md](rfc/RFC-001-SDK-UPGRADE.md) | SDK upgrade process RFC |
| [rfc/RFC-002-OMNIA-RUST-WASM-PARITY.md](rfc/RFC-002-OMNIA-RUST-WASM-PARITY.md) | Omnia Rust/WASM channel state machine parity (implemented) |
| [rfc/RFC-003-OMNIA-BUILT-IN-PROGRAMS.md](rfc/RFC-003-OMNIA-BUILT-IN-PROGRAMS.md) | Omnia built-in channel programs — HTLC, vault, treasury, membership, asset (implemented) |
| [rfc/RFC-006-SDK-INTELLIGENCE-QVAC-INTEGRATION.md](rfc/RFC-006-SDK-INTELLIGENCE-QVAC-INTEGRATION.md) | SDK intelligence/QVAC integration — provider-neutral local AI inference contracts, capability strings, edge gating, agent-policy inference intents (implemented, P0–P7) |
| [rfc/RFC-007-STORAGE-CONSOLIDATION.md](rfc/RFC-007-STORAGE-CONSOLIDATION.md) | Storage consolidation & durable guarantees — `@totemsdk/storage` contract layer (codec/transaction/error taxonomy/artifact boundary + pluggable `ArtifactStoreBackend` port), package persistence matrix (60 pkg, Migrate/Retain/Delegate/Ephemeral/Defer), ProofGraph evidence durability, QVAC verification-level & revocation semantics, audit baseline `e97b2c1` (draft) |
| [rfc/RFC-008-FEDERATED-STATECHAIN.md](rfc/RFC-008-FEDERATED-STATECHAIN.md) | Federated statechain — leased WOTS identity via `root-identity` + `wots-lease`, federation-shaped single-SE redesign (fixes AUD-003/025/045), and the full path to threshold k-of-n SE federation, equivocation proofs/slashing, and an SE marketplace (draft) |
| [rfc/RFC-009-KISSVM-SIGNATURE-FIDELITY.md](rfc/RFC-009-KISSVM-SIGNATURE-FIDELITY.md) | KISSVM signature fidelity — make the script validator Minima-faithful by verifying TreeKey `SignatureProof`s (root public keys) instead of flat WOTS only; unblocks RFC-008's on-chain SE witness (draft) |
| [rfc/RFC-010-INDUSTRIAL-ACTION-RC.md](rfc/RFC-010-INDUSTRIAL-ACTION-RC.md) | Industrial action to RC — layer `@totemsdk/industrial-action` on the governed edge runtime (`AgentEdgeRuntime`/`EdgeActionRegistry`); two-phase/idempotent execution, cryptographic authority-proof binding, retry/timeout/rollback, authority-bound `EdgeReceipt`s; closes the RFC-004 Wave 2 item (draft) |
| [rfc/RFC-011-INDUSTRIAL-ACTION-DOMAIN-MODEL.md](rfc/RFC-011-INDUSTRIAL-ACTION-DOMAIN-MODEL.md) | Industrial action domain model & extensibility — units/quantities, resources/assets, interlocks/safe-state, action composition (recipes/sagas), versioning, lifecycle events, device error taxonomy, concurrency/scheduling, standards mapping, and vertical profiles (draft) |
| [rfc/RFC-012-DECISION-RUNTIME.md](rfc/RFC-012-DECISION-RUNTIME.md) | Decision runtime — provider-neutral typed, constrained, provenance-bound decisions over dynamic candidate spaces (`@totemsdk/decision`); own `decision:*` capability namespace and `EdgeDecisionPort`, sibling to Intelligence, never an Intelligence domain (draft) |
| [rfc/RFC-013-WALLET-SELF-HOSTED-MODE.md](rfc/RFC-013-WALLET-SELF-HOSTED-MODE.md) | Wallet self-hosted mode — Axia relay default with a user-selectable `ChainStateProvider` opt-out (`@totemsdk/chain-provider`) and wallet-side WOTS lease (`@totemsdk/wots-lease` local + on-chain watermark) with a browser storage adapter; extension + PWA parity (draft) |

---

## Public documentation site

The Docusaurus-powered documentation site is at **[totem.ing](https://totem.ing)**. Source and build configuration live in [`../TotemEdgeSDKDocs/`](../TotemEdgeSDKDocs/).

- **Concepts:** Agent policy overview, WOTS key management, Omnia channels, relay modes, Totem Connect
- **Guides:** Tessa Pay, Totem Personal Node, KISSVM Studio, Statechain Pass, Omnia Pocket, Channel Factory Wallet, Omnia Router Node, Totem Community Node, MachinePay Edge, TypeScript Configuration
- **API Reference:** Auto-generated TypeDoc output for all workspace packages
