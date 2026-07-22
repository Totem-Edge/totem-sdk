# Totem SDK

> **The sovereign toolkit for the Minima network.** Cryptographic primitives, KISSVM scripting, recursive MAST policy trees, payment channels, edge computing, on-chain governance, verifiable claims, and AI agent policies — all quantum-resistant, all modular, all open-source.

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![NPM](https://img.shields.io/npm/v/@totemsdk/core?label=core)](https://www.npmjs.com/package/@totemsdk/core)
[![NPM](https://img.shields.io/npm/v/@totemsdk/kissvm?label=kissvm)](https://www.npmjs.com/package/@totemsdk/kissvm)

---

## Why Totem SDK?

Most blockchain SDKs give you a wallet and a JSON-RPC client. Totem SDK gives you **an entire platform** — 52 packages spanning five architectural domains, from quantum-resistant cryptography to AI agent policy enforcement. You pick the pieces you need and leave the rest.

**The problem:** Building on Minima today means hand-rolling WOTS+ signature management, writing KISSVM scripts from scratch, managing payment channel state machines, and figuring out how to connect sensors and gateways to the chain. Every team solves these problems independently, wasting time on infrastructure instead of building their product.

**The solution:** Totem SDK is a **modular framework** where each package solves one problem well. Need quantum-resistant signatures? `@totemsdk/core`. Need a payment channel? `@totemsdk/omnia`. Need to run an MQTT gateway for industrial sensors? `@totemsdk/edge-mqtt`. They compose because they share the same cryptographic foundation, the same type system, and the same design philosophy: **determinism, sovereignty, and quantum-resistance by default.**

### What makes it different

- **Rust/WASM under the hood.** The cryptographic core (`core-wasm`), the KISSVM evaluator (`kissvm`), and the edge MQTT helpers (`edge-mqtt`) are all compiled from Rust to WebAssembly. You get native performance with zero native dependencies.
- **Quantum-resistant from day one.** WOTS+ signatures with 256-bit security against both classical and quantum adversaries. No ECDSA, no Ed25519, no upgrade path needed later.
- **Sovereign by design.** Every package can run on your own hardware — your own lookup node, your own statechain entity server, your own channel factory. No cloud dependency, no trusted third party.
- **AI-ready.** The `agent-policy` package defines a Protobuf-based contract between AI agents and wallets. Agents propose, humans sign. The agent never holds a private key.

---

## The five domains

Totem SDK is organized into five architectural layers. Each layer builds on the one below it.

| Domain | What it does | Key packages |
|--------|-------------|--------------|
| **Cryptographic Foundation** | WOTS+ signatures, TreeKey hierarchy, MMR proofs, Java-compatible serialization, KISSVM script evaluation, recursive MAST compilation, policy trees | `core`, `core-wasm`, `kissvm`, `recursive-mast`, `txpow`, `wots-lease` |
| **Sovereignty Stack** | Personal infrastructure — run your own lookup node, query chain data P2P, stream real-time balances | `lookup-node`, `lookup-client`, `lookup-protocol`, `chain-provider`, `pureminima-rpc`, `realtime` |
| **Payment Network** | Eltoo payment channels, multi-hop routing, channel factories, virtual UTXOs, statechains with blind co-signing | `omnia`, `omnia-factory`, `omnia-router`, `omnia-splice`, `omnia-vtxo`, `statechain`, `se-server` |
| **Edge Computing** | IoT/industrial runtime — MQTT sensor bridges, MachinePay micropayments, P2P device communication, gateways, multi-protocol transport connectors | `edge`, `edge-adapters`, `edge-connectors`, `edge-mqtt`, `pear`, `server`, `pubsub-transport`, `stream-transport` |
| **Verifiable Claims** | WOTS-signed proofs, DID-like identities, signed app manifests, AI agent policies, on-chain governance (voting, delegation), provider reputation, liquidity bonds | `proof`, `proof-integritas`, `proofgraph`, `identity`, `manifest`, `root-identity`, `governance`, `agent-policy`, `provider-bond`, `liquidity-bond` |

### How they compose

```
┌─────────────────────────────────────────────────────────────┐
│                    VERIFIABLE CLAIMS                         │
│  proofs · identity · manifest · agent-policy · reputation   │
├─────────────────────────────────────────────────────────────┤
│                     EDGE COMPUTING                           │
│     MQTT · MachinePay · sensors · gateways · P2P apps       │
├─────────────────────────────────────────────────────────────┤
│                     PAYMENT NETWORK                          │
│   Eltoo channels · routing · statechains · virtual UTXOs    │
├─────────────────────────────────────────────────────────────┤
│                    SOVEREIGNTY STACK                         │
│     lookup nodes · chain data · real-time · P2P queries     │
├─────────────────────────────────────────────────────────────┤
│                CRYPTOGRAPHIC FOUNDATION                       │
│   WOTS+ · TreeKey · MMR · KISSVM · TxPoW · Rust/WASM core   │
└─────────────────────────────────────────────────────────────┘
```

A typical application uses packages from 2-3 layers. A wallet uses the cryptographic foundation + sovereignty stack. A payment app adds the payment network. An industrial gateway uses the cryptographic foundation + edge computing. An AI agent platform uses the cryptographic foundation + verifiable claims. You never pay for what you don't use.

---

## Quick start

### Install what you need

```bash
# Cryptographic primitives (everyone needs this)
pnpm add @totemsdk/core

# KISSVM script evaluation + MAST compiler + templates
pnpm add @totemsdk/kissvm

# Policy coordination (delegation, discovery, signing)
pnpm add @totemsdk/recursive-mast

# On-chain governance (quadratic voting, liquid democracy)
pnpm add @totemsdk/governance

# Payment channels
pnpm add @totemsdk/omnia

# Edge computing: MQTT + multi-protocol connectors
pnpm add @totemsdk/edge @totemsdk/edge-mqtt @totemsdk/edge-connectors

# AI agent policies
pnpm add @totemsdk/agent-policy
```

### Sign and verify with WOTS+

```typescript
import { wotsSign, wotsVerify, derivePKdigest } from '@totemsdk/core';

const seed = crypto.getRandomValues(new Uint8Array(32));
const message = new TextEncoder().encode('hello totem');

const signature = wotsSign(seed, 0, message);
const publicKey = derivePKdigest(seed, 0);
const valid = wotsVerify(signature, message, publicKey);
// Each key index can sign exactly once — use wots-lease to coordinate
```

### Evaluate a KISSVM script

```typescript
import { evaluateScript } from '@totemsdk/kissvm';

const script = 'RETURN @BLOCK GT 500 AND SIGNEDBY(0xABC...)';
const result = evaluateScript(script, witness, txContext);
// { passed: true, trace: [...], instructionsUsed: 42 }
```

### Connect a dApp to a wallet

```typescript
import { WalletDiscovery } from '@totemsdk/connect';

const discovery = new WalletDiscovery();
discovery.onChange((wallets) => {
  const provider = wallets[0]?.provider;
  // provider.request({ method: 'TOTEM_CONNECT', ... })
});
```

---

## Architecture

### Monorepo structure

```
packages/
├── totem-sdk/packages/     # 52 SDK packages (the platform)
├── totem-extension/        # Chrome MV3 browser extension wallet
├── totem-pwa-wallet/       # Progressive web app wallet
├── totem-dapp-starter/     # dApp starter template
├── totem-pear-android-starter/  # Android Pear runtime starter
└── observability/          # Telemetry and monitoring
```

### Technology stack

| Layer | Technology |
|-------|-----------|
| **Runtime** | Node.js, Browser, Pear/Bare (Android) |
| **Crypto engine** | Rust → WASM (`core-wasm`, `kissvm`, `edge-mqtt`) |
| **Hashing** | SHA3-256, SHA-256 (Rust `sha3` + `sha2` crates) |
| **P2P** | Hyperswarm, Hypercore, Hyperbee |
| **Package manager** | pnpm workspaces |
| **Language** | TypeScript (strict mode throughout) |

### Rust/WASM packages

Three packages ship Rust code compiled to WebAssembly for deterministic, high-performance execution:

| Package | Rust crate | Lines | What it does |
|---------|-----------|-------|-------------|
| `@totemsdk/core-wasm` | `totemsdk-core-wasm` | ~2,720 | WOTS+ signatures, SHA3-256, TreeKey, TxPoW mining, BIP39 |
| `@totemsdk/kissvm` | `kissvm-wasm` | ~1,800 | KISSVM v1 evaluator — lexer, parser, VM, all opcodes |
| `@totemsdk/edge-mqtt` | `edge-mqtt-wasm` | ~550 | Canonical JSON, MQTT topic matching, fixed-point arithmetic |

Each package also ships a TypeScript fallback and a `wasm-sync.ts` bridge that provides a synchronous API over the async WASM loader.

---

## Security

### Quantum-resistant by default

Totem SDK uses **WOTS+ (Winternitz One-Time Signatures)** with parameters w=8, n=256, L=34. Each seed phrase generates 262,144 one-time signatures across a 3-level hierarchical TreeKey structure. There is no ECDSA, no Ed25519, no secp256k1 — nothing that a sufficiently large quantum computer could break.

### Key security properties

- **Keys never leave your device** — all signing happens client-side
- **PBKDF2 key derivation** — 200,000+ iterations for password-derived keys
- **AES-256-GCM encryption** — for stored seeds and mnemonics
- **Session seed zeroing** — private keys cleared from memory on lock
- **WOTS lease coordination** — prevents catastrophic key reuse across devices
- **Constant-time comparison** — all cryptographic comparisons use `timingSafeEqual`
- **No external crypto dependencies** — hashing is done in Rust/WASM, no npm crypto packages

### Reporting vulnerabilities

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
- **GitHub:** [github.com/Totem-Edge/totem-sdk](https://github.com/Totem-Edge/totem-sdk)
- **NPM:** [@totemsdk](https://www.npmjs.com/org/totemsdk)

---

## Contributing

We welcome contributions. See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) for community standards.

### Development setup

```bash
git clone https://github.com/Totem-Edge/totem-sdk.git
cd totem-sdk
pnpm install
```

### Running tests

```bash
pnpm test:sdk        # SDK unit tests
pnpm test:extension  # Extension tests
```

### Building Rust/WASM packages

```bash
# Install Rust + wasm-pack (one-time)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
cargo install wasm-pack

# Build a specific WASM package
cd packages/totem-sdk/packages/kissvm
npm run build:wasm
```

---

## License

MIT License — See [LICENSE](LICENSE) for details.

---

<div align="center">

**Built by the Totem SDK Contributors**

[Website](https://totem.ing) • [Documentation](https://totem.ing) • [GitHub](https://github.com/Totem-Edge/totem-sdk)

</div>
