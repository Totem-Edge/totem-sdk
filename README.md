# Axia Blockchain Development Platform

> Enterprise-grade blockchain infrastructure for the Minima network featuring quantum-resistant cryptography, API gateway services, browser wallet, and exchange infrastructure.

[![Status](https://img.shields.io/badge/status-production-green.svg)](https://status.axia.minima.global)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-2.1.0-blue.svg)](docs/developers/sdk/release-notes.md)

---

## 🚀 Quick Start

### For End Users (Wallet)
Want to use Minima blockchain with a simple browser wallet?

1. **Install Totem Extension** - [Chrome Web Store Link]
2. **Create Your Wallet** - Follow the [User Journey Guide](docs/users/free/totem-user-journey.md)
3. **Get Free Access** - Automatic connection to Axia API (100 requests/day)

### For Developers (API Integration)
Building a dApp or integrating Minima blockchain into your application?

1. **Sign Up** - Create a free account at [Dashboard Link]
2. **Follow Onboarding** - [Developer Onboarding Checklist](docs/users/developer/onboarding-checklist.md)
3. **Make Your First API Call** - See [Quick Start Examples](#developer-quick-start)
4. **Review Pricing** - [Tier Comparison](docs/developers/api/tier-comparison.md)

### For Enterprises (CEX/DEX)
Need exchange infrastructure or custom integrations?

1. **Contact Sales** - sales@axia.minima.global
2. **Schedule Demo** - Review CEX/DEX capabilities
3. **Follow Enterprise Onboarding** - [Enterprise Checklist](docs/users/enterprise/onboarding-checklist.md)
4. **Review Technical Docs** - [CEX API Guide](docs/developers/api/enterprise/cex-api-guide.md)

---

## 📚 Documentation by Role

### 👤 End Users
Totem wallet users and Minima blockchain enthusiasts:

- **Free Tier** (Totem Wallet Users)
  - [User Journey](docs/users/free/totem-user-journey.md) - Complete walkthrough
  - [Security FAQ](docs/developers/extension/security-faq.md) - Safety & best practices
  
- **Paid Tiers** (Developers & Enterprises)
  - [Developer Onboarding](docs/users/developer/onboarding-checklist.md)
  - [Enterprise Onboarding](docs/users/enterprise/onboarding-checklist.md)
  - [Pricing FAQ](docs/users/pricing-faq.md) - Billing & credit questions

### 💻 Developers
Technical integration documentation:

- **API Gateway**
  - [Tier Comparison](docs/developers/api/tier-comparison.md) - Feature matrix & limits
  - [CEX API Guide](docs/developers/api/enterprise/cex-api-guide.md) - Exchange integration
  - [DEX Integration Guide](docs/developers/api/enterprise/dex-integration-guide.md) - Decentralized exchange

- **SDK & Libraries**
  - [Release Notes](docs/developers/sdk/release-notes.md) - Version history & migration guides
  - [WOTS Developer Guide](docs/developers/sdk/wots-developer-guide.md) - Quantum-resistant signatures
  - [Crypto Serialization](docs/developers/sdk/crypto-serialization.md) - Java-compatible serialization
  - [Tree-of-Trees Architecture](docs/developers/sdk/tree-of-trees-architecture.md) - Hierarchical key structure
  - [Address Generation](docs/developers/sdk/address-generation.md) - Technical details
  - [Totem Wallet Spec](TOTEM_WALLET_SPEC.md) - Complete WOTS/TreeKey specification

- **Browser Extension**
  - [dApp Developer Guide](packages/totem-extension/docs/TOTEM_CONNECT.md) - **Primary integration reference** (provider API, RPC methods, events)
  - [Wallet Initialization](docs/developers/extension/wallet-initialization.md) - Technical flow
  - [Testing Checklist](docs/developers/extension/testing-checklist.md) - QA procedures
  - [Security FAQ](docs/developers/extension/security-faq.md) - Cryptography & safety

- **Observability**
  - [Prometheus Metrics Catalog](docs/developers/observability/prometheus-metrics-catalog.md) - Metrics reference
  - [Grafana Dashboards Guide](docs/developers/observability/grafana-dashboards-guide.md) - Visualization
  - [Loki Logging Guide](docs/developers/observability/loki-logging-guide.md) - Log aggregation
  - [Tempo Tracing Guide](docs/developers/observability/tempo-tracing-guide.md) - Distributed tracing

### 👔 Administrators
Operations, support, and platform management:

- **Support Team**
  - [Incident Response](docs/admins/support/incident-response.md) - SEV levels & procedures
  - [Admin Escalation](docs/admins/support/admin-escalation.md) - Email templates & workflows

- **Operations Team**
  - [Telemetry Runbook](docs/admins/ops/enterprise/telemetry-runbook.md) - Monitoring ops
  - [Observability Guide](docs/admins/ops/observability-guide.md) - Prometheus & Grafana

- **Platform Team**
  - [Production Readiness](docs/admins/platform/production-readiness.md) - Deployment checklist
  - [Infrastructure Overview](docs/admins/platform/infrastructure-overview.md) - Architecture
  - [Node Pool Policy](docs/admins/platform/node-pool-policy.md) - Resource management
  - [Rollout Plan](docs/admins/platform/rollout-plan.md) - Staged deployment

### 🏢 Internal Team
Strategy, architecture, and planning docs:

- **Strategy**
  - [Architecture](docs/internal/strategy/architecture.md) - Platform architecture
  - [CEX Rollout Playbook](docs/internal/strategy/cex-rollout-playbook.md) - Exchange implementation
  - [File Map](docs/internal/strategy/file-map.md) - Codebase navigation
  - [Totem UX Architecture](docs/internal/strategy/totem-ux-architecture.md) - Design system
  - [Transaction Flow](docs/internal/strategy/transaction-flow.md) - Technical workflow

- **Archive**
  - [Serializer Porting](docs/internal/archive/serializer-porting.md) - Legacy migration notes

---

## 🏗️ Product Suite

### 1. ⚡ Axia API Gateway
Professional blockchain API infrastructure with enterprise-grade features.

**Features:**
- 🔑 **Credit-Based Billing** - Pay only for what you use
- 🚦 **Rate Limiting** - Token bucket algorithm with burst support
- 📊 **Real-Time Analytics** - Usage tracking and performance metrics
- 🔐 **Secure Authentication** - API keys + JWT for admin operations
- 🌐 **80+ RPC Methods** - Complete Minima blockchain access
- 📈 **Observability** - Prometheus metrics + Grafana dashboards

**Tiers:** Free → Developer ($29/mo) → Growth ($99/mo) → Scale ($299/mo) → Enterprise (custom)

[Learn More →](docs/developers/api/tier-comparison.md)

### 2. 🔐 Totem SDK
Quantum-resistant cryptography library for Minima blockchain.

**Features:**
- 🛡️ **WOTS Signatures** - Quantum-resistant w=8 implementation
- 🌲 **Tree-of-Trees** - 262,144 signatures per seed
- 🔒 **Key Management** - Hierarchical derivation + usage tracking
- ⚡ **Client-Side Signing** - Keys never leave your device
- 🎯 **Minima Compatible** - Direct integration with blockchain

[Release Notes →](docs/developers/sdk/release-notes.md)

### 3. 🦊 Totem Wallet
MetaMask-style browser extension for Minima blockchain.

**Features:**
- 🔐 **Client-Side Keys** - PBKDF2 + AES-GCM encryption
- 🌐 **dApp Integration** - Standard provider API
- 📱 **Modern UI** - Dark theme, responsive design
- 🔔 **Real-Time Updates** - WebSocket blockchain sync
- 🔒 **Passkey Support** - Hardware security keys (WebAuthn)

[dApp Developer Guide →](packages/totem-extension/docs/TOTEM_CONNECT.md) | [Security FAQ →](docs/developers/extension/security-faq.md)

### 4. 🎛️ Axia Dashboard
Unified subscription and API key management portal.

**Features:**
- 📊 **Usage Analytics** - Real-time credit consumption
- 🔑 **API Key Management** - Create, rotate, revoke keys
- 💳 **Billing** - Subscription management + overage billing
- 👥 **Team Collaboration** - Multi-user project access
- 📈 **Forecasting** - Cost optimization insights

[Developer Onboarding →](docs/users/developer/onboarding-checklist.md)

### 5. 🏦 CEX Infrastructure
Multi-tenant centralized exchange integration system.

**Features:**
- 🔐 **Tenant Isolation** - Complete separation per exchange
- 💰 **Deposit Management** - Address generation + webhooks
- 📤 **Withdrawal Batching** - Hot + cold wallet support
- 📚 **Ledger System** - Complete audit trail
- 🔍 **AML Controls** - Allowlist/denylist management
- ⚡ **Rate Limiting** - Per-tenant request controls

[CEX API Guide →](docs/developers/api/enterprise/cex-api-guide.md)

### 6. 🔄 DEX Components
Decentralized exchange infrastructure (Scale/Enterprise only).

**Features:**
- 🏊 **AMM Pools** - Constant product market maker
- 📋 **CLOB** - Central limit order book
- 💱 **RFQ Aggregation** - Request for quote routing
- 🔒 **MAST Covenants** - Secure smart contract templates

[DEX Integration Guide →](docs/developers/api/enterprise/dex-integration-guide.md)

---

## Developer Quick Start

### Installation
```bash
npm install @totem/sdk
```

### Make Your First API Call
```javascript
const axios = require('axios');

const PROJECT_ID = 'your_project_id';
const API_KEY = 'your_api_key';

// Get blockchain status
const response = await axios.get(
  `https://axia.minima.global/v1/${PROJECT_ID}/status`,
  { headers: { 'Authorization': `Bearer ${API_KEY}` } }
);

console.log(response.data);
```

### Using Totem SDK
```typescript
import { WOTS } from '@totem/sdk-core';

// Generate quantum-resistant signature
const wots = new WOTS();
const signature = await wots.sign(message, privateKey);
```

### Provider API (Browser)
```javascript
// Step 0: Discover the wallet via totem:announce (no window.totem global)
import { WalletDiscovery } from '@totemsdk/connect';
const discovery = new WalletDiscovery();
let provider;
discovery.onChange((wallets) => { if (wallets.length >= 1) provider = wallets[0].provider; });

// Step 1: Connect — user picks address in popup
const connection = await provider.request({
  method: 'TOTEM_CONNECT',
  params: { origin: window.location.origin }
});

// Step 2: Verify immediately — proves address ownership (mandatory)
const verification = await provider.request({
  method: 'TOTEM_VERIFY',
  params: { origin: window.location.origin, challenge: { statement: 'Sign in to MyDApp' } }
});

// Step 3: Retrieve account
const acct = await provider.request({
  method: 'TOTEM_GET_ACCOUNTS',
  params: { origin: window.location.origin }
});
const { address } = acct.accounts[0];

// Step 4: Send a transaction
const result = await provider.request({
  method: 'TOTEM_SEND_TRANSACTION',
  params: {
    origin: window.location.origin,
    request: {
      version: 1,
      intent: 'send',
      outputs: [{ address: 'Mx...', amount: '10', tokenId: '0x00' }]
    }
  }
});
if (result.success) console.log('Transaction submitted:', result.txpowid);
```

[Full API Reference →](docs/developers/api/)

---

## 📊 Tier Comparison

| Feature | Free | Developer | Growth | Scale | Enterprise |
|---------|------|-----------|--------|-------|------------|
| **Price** | $0 | $29/mo | $99/mo | $299/mo | Custom |
| **Credits/Month** | 100K | 1M | 10M | 50M | Unlimited |
| **Rate Limit (RPM)** | 10 | 100 | 500 | 1000 | Custom |
| **Projects** | 1 | 3 | 10 | 25 | Unlimited |
| **Support** | Community | Email | Priority | Slack | 24/7 |
| **SLA** | - | 99.5% | 99.9% | 99.95% | 99.99% |
| **CEX/DEX** | ❌ | ❌ | ❌ | ✅ | ✅ Full |

[Complete Comparison →](docs/developers/api/tier-comparison.md) | [Pricing FAQ →](docs/users/pricing-faq.md)

---

## 🔒 Security

### Quantum-Resistant Cryptography
Totem uses **WOTS (Winternitz One-Time Signatures)** to protect against future quantum computer attacks. Your private keys are safe even as quantum computing advances.

### Client-Side Security
- **Keys never leave your device** - All signing happens client-side
- **PBKDF2 encryption** - 100,000 iterations for password-derived keys
- **AES-GCM encryption** - Military-grade encryption for stored seeds
- **No external dependencies** - All cryptography runs locally

### API Security
- **API key authentication** - Secure token-based access
- **Rate limiting** - Token bucket algorithm prevents abuse
- **Usage tracking** - Real-time credit deduction
- **Audit logging** - Complete request history

[Security FAQ →](docs/developers/extension/security-faq.md) | [Report Vulnerability →](#security-contact)

---

## 🏗️ Architecture

### Monorepo Structure
```
packages/
├── totem-sdk/           # Quantum-resistant cryptography library
├── totem-extension/     # Browser wallet extension
├── totem-dex/           # DEX integration helpers
├── axia-api/            # API Gateway service
├── axia-dashboard/      # User dashboard & admin portal
├── axia-homepage/       # Marketing website
├── telemetry-ingestor/  # Observability service
└── assets/              # Shared resources
```

### Technology Stack
- **Backend:** Node.js, Express, Fastify
- **Frontend:** React, Vite, TailwindCSS
- **Database:** PostgreSQL (Neon), SQLite
- **Queue:** BullMQ + Redis
- **Observability:** Prometheus, Grafana, Loki, Tempo
- **Crypto:** @noble/hashes (SHA3-256), custom WOTS implementation

[Architecture Details →](docs/internal/strategy/architecture.md)

---

## 🌍 Ecosystem

### Live Services
- **Dashboard:** [https://dashboard.axia.minima.global](#)
- **API Gateway:** [https://axia.minima.global](#)
- **Status Page:** [https://status.axia.minima.global](#)
- **Documentation:** [https://docs.axia.minima.global](#)

### Community
- **Discord:** [Community Server](#)
- **Twitter:** [@AxiaMinima](#)
- **GitHub:** [github.com/axia](#)
- **Blog:** [blog.axia.minima.global](#)

---

## 💬 Support

### Getting Help

**End Users (Totem Wallet):**
- Community Discord: [Link]
- Support Email: support@axia.minima.global

**Developers:**
- Developer tier: Email support (24-48hr)
- Growth tier: Priority email (4-12hr)
- Documentation: [docs.axia.minima.global](#)

**Enterprise:**
- Dedicated Slack channel
- 24/7 phone support
- Account manager
- Email: enterprise-support@axia.minima.global

[Contact Sales →](mailto:sales@axia.minima.global) | [Report Issues →](#)

---

## 🤝 Contributing

We welcome contributions from the community! Please see our contributing guidelines (coming soon).

### Development Setup
```bash
# Clone repository
git clone https://github.com/axia/axia-platform.git
cd axia-platform

# Install dependencies
npm install

# Start development environment
npm run dev
```

### Running Tests
```bash
# Run all tests
npm test

# Run specific package tests
cd packages/totem-sdk && npm test

# Run extension tests
cd packages/totem-extension && npm run test:e2e
```

---

## 📄 License

MIT License - See [LICENSE](LICENSE) file for details.

---

## 🔗 Quick Links

### Documentation
- [Developer Onboarding](docs/users/developer/onboarding-checklist.md)
- [Enterprise Onboarding](docs/users/enterprise/onboarding-checklist.md)
- [API Tier Comparison](docs/developers/api/tier-comparison.md)
- [Pricing FAQ](docs/users/pricing-faq.md)
- [Release Notes](docs/developers/sdk/release-notes.md)

### Technical Guides
- [CEX API Guide](docs/developers/api/enterprise/cex-api-guide.md)
- [DEX Integration Guide](docs/developers/api/enterprise/dex-integration-guide.md)
- [Security FAQ](docs/developers/extension/security-faq.md)
- [Production Readiness](docs/admins/platform/production-readiness.md)

### Admin Resources
- [Incident Response](docs/admins/support/incident-response.md)
- [Admin Escalation](docs/admins/support/admin-escalation.md)
- [Observability Guide](docs/admins/ops/observability-guide.md)
- [Telemetry Runbook](docs/admins/ops/enterprise/telemetry-runbook.md)

---

<div align="center">

**Built with ❤️ by the Axia team**

[Website](#) • [Dashboard](#) • [Documentation](#) • [Community](#)

</div>
