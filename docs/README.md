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

## Research & vision

| Document | Description |
|----------|-------------|
| [building-eefi-with-totem-edge.md](building-eefi-with-totem-edge.md) | **Building Eefi with Totem Edge** — Edge DeFi explained: how IoT devices, sensors, and machines run their own payment channels, liquidity pools, and governance on Minima. Covers Omnia eltoo channels, statechains, VTXOs, channel factories, MachinePay, provider bonds, recursive MAST, quadratic governance, QVAC agent policy, and the full 41-package Eefi stack. |

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
| `@totemsdk/core` | [Integration guide](../packages/core/docs/INTEGRATION_GUIDE.md) — server-side verification, hex conventions, TreeSignature format |
| `@totemsdk/authority` | [Governance boundary](../packages/authority/docs/authority-governance-boundary.md), [Governance design](../packages/authority/docs/governance-design.md) |
| `@totemsdk/edge-adapters` | [Protocol adapters plan](../packages/edge-adapters/docs/edge-protocol-adapters-plan.md) |

---

## Operations & runbooks

| Document | Description |
|----------|-------------|
| [SDK_AUDIT.md](SDK_AUDIT.md) | Package audit, status, and parity gap table |
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

---

## Public documentation site

The Docusaurus-powered documentation site is at **[totem.ing](https://totem.ing)**. Source and build configuration live in [`../TotemEdgeSDKDocs/`](../TotemEdgeSDKDocs/).

- **Concepts:** Agent policy overview, WOTS key management, Omnia channels, relay modes, Totem Connect
- **Guides:** Tessa Pay, Totem Personal Node, KISSVM Studio, Statechain Pass, Omnia Pocket, Channel Factory Wallet, Omnia Router Node, Totem Community Node, MachinePay Edge, TypeScript Configuration
- **API Reference:** Auto-generated TypeDoc output for all 50+ packages
