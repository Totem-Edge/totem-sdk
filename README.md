# Totem SDK

> Quantum-resistant decentralized computing platform for the Minima network — cryptographic primitives, payment channels, edge computing, verifiable claims, and sovereign infrastructure.

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-2.1.0-blue.svg)](https://totem.ing)

---

## What is Totem SDK?

Totem SDK is a complete platform for building quantum-resistant applications on the Minima blockchain. It spans five architectural domains:

| Domain | Packages | Description |
|--------|----------|-------------|
| **Cryptographic Foundation** | `core` | WOTS+ signatures, TreeKey hierarchy, MMR proofs, Java-compatible serialization |
| **Sovereignty Stack** | `lookup-*`, `chain-provider`, `pureminima-rpc`, `realtime` | Personal infrastructure — run your own node, query chain data P2P |
| **Payment Network** | `omnia*`, `statechain`, `se-server` | Eltoo payment channels, multi-hop routing, channel factories, statechains |
| **Edge Computing** | `edge`, `edge-adapters`, `edge-mqtt`, `pear`, `server` | IoT/industrial runtime with MQTT, MachinePay, P2P apps |
| **Verifiable Claims** | `proof*`, `identity`, `manifest`, `root-identity`, `agent-policy`, `provider-bond`, `liquidity-bond` | WOTS-signed proofs, DID-like identities, reputation, AI agent policies |

---

## Quick Start

### Installation

```bash
pnpm add @totemsdk/core
```

### Using Totem SDK

```typescript
import { TreeKey, wotsSign, wotsVerify } from '@totemsdk/core';

// Create a key tree from a 32-byte seed
const seed = crypto.getRandomValues(new Uint8Array(32));
const treeKey = new TreeKey(seed);

// Sign data with the current key
const signature = treeKey.sign(data);

// Verify a tree signature
const isValid = verifyTreeSignature(treeKey.getPublicKey(), data, signature);
```

### Provider API (Browser)

```javascript
// Step 0: Discover the wallet via totem:announce
import { WalletDiscovery } from '@totemsdk/connect';
const discovery = new WalletDiscovery();
let provider;
discovery.onChange((wallets) => { if (wallets.length >= 1) provider = wallets[0].provider; });

// Step 1: Connect — user picks address in popup
const connection = await provider.request({
  method: 'TOTEM_CONNECT',
  params: { origin: window.location.origin }
});

// Step 2: Verify immediately — proves address ownership
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

---

## Architecture

### Monorepo Structure

```
packages/
├── observability/                # Telemetry & observability
├── totem-dapp-starter/           # dApp starter template
├── totem-extension/              # Chrome MV3 browser extension
├── totem-pear-android-starter/   # Android Pear starter
├── totem-pwa-wallet/             # PWA wallet
└── totem-sdk/                    # Core SDK (37 packages)
    └── packages/
        ├── agent-policy/         # AI agent policy contracts
        ├── chain-provider/       # Unified chain data provider
        ├── connect/              # dApp wallet connection protocol
        ├── core/                 # Cryptographic primitives (WOTS, TreeKey, MMR)
        ├── edge/                 # Edge computing runtime
        ├── edge-adapters/        # Edge port adapters
        ├── edge-mqtt/            # MQTT transport for IoT edge
        ├── identity/             # DID-like identity layer
        ├── kissvm/               # KISSVM smart contract evaluator
        ├── liquidity-bond/       # LP position management
        ├── lookup-client/        # P2P lookup client
        ├── lookup-node/          # Personal lookup node
        ├── lookup-protocol/      # Lookup wire protocol
        ├── manifest/             # Signed app/agent declarations
        ├── omnia/                # Eltoo payment channel state machine
        ├── omnia-factory/        # N-of-N channel factories
        ├── omnia-router/         # Multi-hop payment routing
        ├── omnia-splice/         # Live channel resizing
        ├── omnia-vtxo/           # Virtual UTXO claim layer
        ├── pear/                 # Pear/Bare runtime integration
        ├── proof/                # WOTS-signed proof envelopes
        ├── proof-integritas/     # On-chain hash anchoring
        ├── proofgraph/           # Content-addressed proof DAG
        ├── provider-bond/        # Infrastructure provider trust
        ├── pubsub-transport/     # Pub/sub transport abstraction
        ├── pureminima-rpc/       # Pure Minima RPC client
        ├── realtime/             # Real-time balance streaming
        ├── root-identity/        # Hierarchical identity system
        ├── sdk-tests/            # Cross-package integration tests
        ├── se-server/            # Statechain Entity server
        ├── server/               # Node.js server SDK
        ├── statechain/           # Mercury statechain protocol
        ├── stream-transport/     # Stream transport abstraction
        ├── tx-builder/           # Transaction builder
        ├── txpow/                # TxPoW proof-of-work
        ├── wallet-adapter/       # Third-party wallet base class
        └── wots-lease/           # WOTS key-use coordination
```

### Technology Stack

- **Runtime:** Node.js, Browser, Pear/Bare
- **Frontend:** React, Vite, TailwindCSS
- **Crypto:** @noble/hashes (SHA3-256), custom WOTS implementation
- **P2P:** Hyperswarm, Hypercore, Hyperbee
- **Package Manager:** pnpm workspaces

---

## Security

### Quantum-Resistant Cryptography

Totem uses **WOTS+ (Winternitz One-Time Signatures)** with parameters w=8, n=256, L=34 to protect against quantum computer attacks. Each seed phrase generates 262,144 one-time signatures across a 3-level hierarchical TreeKey structure.

### Key Security Properties

- **Keys never leave your device** — all signing happens client-side
- **PBKDF2 encryption** — 200,000+ iterations for password-derived keys
- **AES-256-GCM encryption** — for stored seeds and mnemonics
- **Session seed zeroing** — private keys cleared from memory on lock
- **WOTS lease coordination** — prevents catastrophic key reuse across devices
- **Constant-time comparison** — all cryptographic comparisons use `timingSafeEqual`
- **No external crypto dependencies** — only `@noble/hashes` (audited)

### Reporting Vulnerabilities

See [SECURITY.md](SECURITY.md) for our vulnerability disclosure policy.

---

## Documentation

- **API Reference:** [https://totem.ing](https://totem.ing)
- **WOTS/TreeKey Spec:** [TOTEM_WALLET_SPEC.md](TOTEM_WALLET_SPEC.md)
- **Lease/Watermark Spec:** [LEASE_WATERMARK_SPEC.md](LEASE_WATERMARK_SPEC.md)
- **Privacy Note:** [TOTEM_PRIVACY_NOTE.md](TOTEM_PRIVACY_NOTE.md)
- **dApp Integration:** [TOTEM_CONNECT.md](packages/totem-extension/docs/TOTEM_CONNECT.md)

---

## Community

- **Website:** [https://totem.ing](https://totem.ing)
- **GitHub:** [github.com/totem-sdk](https://github.com/totem-sdk)
- **NPM:** [@totemsdk](https://www.npmjs.com/org/totemsdk)

---

## Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) for community standards.

### Development Setup

```bash
# Clone repository
git clone https://github.com/MrGheek/totem-sdk.git
cd totem-sdk

# Install dependencies
pnpm install
```

### Running Tests

```bash
# Run SDK tests
pnpm test:sdk

# Run extension tests
pnpm test:extension
```

---

## License

MIT License — See [LICENSE](LICENSE) for details.

---

<div align="center">

**Built by the Totem SDK Contributors**

[Website](https://totem.ing) • [Documentation](https://totem.ing) • [GitHub](https://github.com/totem-sdk)

</div>
