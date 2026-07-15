# @totemsdk — Totem SDK for Minima

The official TypeScript SDK for building on the [Minima](https://minima.global) blockchain. 35 packages covering everything from quantum-resistant signatures to payment channels, smart contracts, and AI agent integration.

## Where to start

| I want to… | Start here |
|-----------|------------|
| Build a browser dApp that connects to the Totem wallet | [`@totemsdk/connect`](packages/connect) |
| Use the cryptographic primitives directly | [`@totemsdk/core`](packages/core) |
| Run my own chain indexer / self-sovereign infrastructure | [`@totemsdk/lookup-node`](packages/lookup-node) |
| Build payment channels and multi-hop routing | [`@totemsdk/omnia`](packages/omnia) + the omnia suite |
| Understand quantum-safe key management | [`@totemsdk/wots-lease`](packages/wots-lease) |

---

## All packages

| Package | Version | Description |
|---------|---------|-------------|
| [`@totemsdk/core`](packages/core) | 1.1.0 | The cryptographic engine — WOTS, TreeKey, BIP39, MMR, serialization |
| [`@totemsdk/connect`](packages/connect) | 2.0.1 | The dApp gateway — everything a web app needs to talk to the Totem extension |
| [`@totemsdk/chain-provider`](packages/chain-provider) | 0.1.4 | Unified abstraction over all chain data sources |
| [`@totemsdk/pureminima-rpc`](packages/pureminima-rpc) | 0.1.3 | Direct RPC to a self-hosted PureMinima node — works in every JS runtime |
| [`@totemsdk/realtime`](packages/realtime) | 0.1.9 | Live balance streaming with WebSocket and HTTP fallback |
| [`@totemsdk/lookup-protocol`](packages/lookup-protocol) | 0.1.1 | Wire protocol spec for the P2P lookup network |
| [`@totemsdk/lookup-client`](packages/lookup-client) | 0.1.1 | Connect to your personal lookup node from any app |
| [`@totemsdk/lookup-node`](packages/lookup-node) | 0.1.1 | Run your own always-on personal lookup node |
| [`@totemsdk/wots-lease`](packages/wots-lease) | 0.1.3 | WOTS key safety — prevents catastrophic signature slot reuse |
| [`@totemsdk/txpow`](packages/txpow) | 0.1.6 | TxPoW — Minima's spam-prevention proof-of-work on every transaction |
| [`@totemsdk/tx-builder`](packages/tx-builder) | 0.1.6 | Construct Minima transactions in pure TypeScript |
| [`@totemsdk/kissvm`](packages/kissvm) | 0.1.1 | Minima's smart contract language — in pure TypeScript |
| [`@totemsdk/omnia`](packages/omnia) | 0.1.5 | Eltoo payment channels — the heart of Totem's payment network |
| [`@totemsdk/omnia-factory`](packages/omnia-factory) | 0.1.2 | Scale payment channels — N-of-N funded factory channels |
| [`@totemsdk/omnia-router`](packages/omnia-router) | 0.1.1 | Multi-hop payments and cross-token swaps across the channel network |
| [`@totemsdk/omnia-splice`](packages/omnia-splice) | 0.1.5 | Resize channels without closing them |
| [`@totemsdk/omnia-vtxo`](packages/omnia-vtxo) | 0.1.1 | VTXO management for Omnia channels |
| [`@totemsdk/root-identity`](packages/root-identity) | 1.0.7 | One seed → up to 64 blockchain addresses, all cryptographically provable |
| [`@totemsdk/statechain`](packages/statechain) | 0.1.1 | Off-chain UTXO ownership transfer using the Mercury protocol |
| [`@totemsdk/agent-policy`](packages/agent-policy) | 0.1.1 | The interface seam between human wallets and AI agents |
| [`@totemsdk/pear`](packages/pear) | 0.1.2 | Run Totem SDK apps inside Holepunch's Pear/Bare runtime |
| [`@totemsdk/edge`](packages/edge) | 0.1.2 | Edge computing runtime for IoT and mobile devices |
| [`@totemsdk/edge-adapters`](packages/edge-adapters) | 0.1.1 | Adapter interfaces for edge environments |
| [`@totemsdk/edge-mqtt`](packages/edge-mqtt) | 0.1.1 | MQTT transport for edge devices |
| [`@totemsdk/identity`](packages/identity) | 0.1.1 | Identity management and verification |
| [`@totemsdk/manifest`](packages/manifest) | 0.1.1 | Manifest handling for Pear apps |
| [`@totemsdk/proof`](packages/proof) | 0.1.1 | Proof generation and verification |
| [`@totemsdk/proof-integritas`](packages/proof-integritas) | 0.1.1 | Integritas proof-of-existence system |
| [`@totemsdk/proofgraph`](packages/proofgraph) | 0.1.1 | Proof graph construction |
| [`@totemsdk/pubsub-transport`](packages/pubsub-transport) | 0.1.1 | PubSub transport layer |
| [`@totemsdk/se-server`](packages/se-server) | 0.1.2 | Statechain Entity server |
| [`@totemsdk/server`](packages/server) | 0.1.1 | Server utilities |
| [`@totemsdk/stream-transport`](packages/stream-transport) | 0.1.1 | Stream transport layer |
| [`@totemsdk/wallet-adapter`](packages/wallet-adapter) | 0.1.1 | Wallet adapter interfaces |
| [`@totemsdk/sdk-tests`](packages/sdk-tests) | 0.1.1 | Integration tests for the SDK |

> **Note:** The `@totemsdk/node` and `@totemsdk/omnia-hyperswarm` packages referenced in older documentation are not included in this repository. Use the packages listed above for all new projects.

---

## Dependency map

```
core ─────────────────────── (no production dependencies; @noble/hashes peer only)
pureminima-rpc ───────────── (no dependencies — fetch-based, runtime-agnostic)
pear ─────────────────────── (no dependencies — runtime adapter)
agent-policy ─────────────── (no dependencies — types only)
tx-builder ───────────────── @noble/hashes only

realtime ─────────────────── core
txpow ────────────────────── core
kissvm ───────────────────── core
root-identity ────────────── core
chain-provider ───────────── core, pureminima-rpc
lookup-protocol ──────────── core
wots-lease ───────────────── core, lookup-protocol

lookup-client ────────────── core, lookup-protocol, chain-provider
omnia-router ─────────────── core
omnia-hyperswarm ─────────── core, omnia, lookup-protocol

omnia ────────────────────── core, tx-builder, txpow, wots-lease, chain-provider, agent-policy
statechain ───────────────── core, wots-lease, tx-builder, txpow, chain-provider
omnia-splice ─────────────── core, omnia, tx-builder, txpow, wots-lease
omnia-factory ────────────── core, omnia, wots-lease, tx-builder, txpow, chain-provider

lookup-node ──────────────── core, lookup-protocol, chain-provider, pureminima-rpc,
                              wots-lease, txpow, better-sqlite3

node ─────────────────────── core, txpow  (+node-fetch, ws)
connect ──────────────────── (no dependencies; optional peers: omnia suite, statechain, etc.)
```

---

## Five cross-cutting themes

### Theme 1 — Quantum resistance is non-negotiable
Every signing operation across all 22 packages flows through WOTS TreeKeys. The `wots-lease` system prevents the one fatal mistake (key reuse). `root-identity` turns this into a usable multi-address identity system.

### Theme 2 — Sovereignty stack
`lookup-node` + `lookup-client` + `lookup-protocol` form a personal decentralised infrastructure layer. Run your own chain indexer, relay, and app registry on Hyperswarm without relying on any Totem/Axia servers.

### Theme 3 — Omnia is a complete payment network
`omnia` + `omnia-factory` + `omnia-router` + `omnia-splice` + `omnia-hyperswarm` is a full eltoo payment channel network — channels, multi-hop routing, cross-token swaps, factory scaling, live channel resizing, and P2P transport — all in TypeScript.

### Theme 4 — AI agent readiness
`agent-policy` defines the contracts that let AI agents propose and execute payments within bounded, auditable policies. `connect` exposes this as extension methods. The architecture anticipates autonomous agents transacting on behalf of users with provable receipts.

### Theme 5 — Pear-native decentralisation
`pear` + `omnia-hyperswarm` + `lookup-node` together enable apps with zero server dependency — wallets, payment channels, chain data, and app discovery all run peer-to-peer over the Hyperswarm DHT inside Pear apps.

---

## WOTS Index Naming Convention

The SDK uses a 3-level hierarchical tree for WOTS signatures. Each signature is uniquely identified by three indices:

| SDK / Wire Name | Range | Meaning |
|-----------------|-------|---------|
| `addressIndex` | 0–63 | Which address (maps to a TreeKey root) |
| `l1` | 0–63 | Level-1 signing node within that address |
| `l2` | 0–63 | Level-2 leaf key (the actual one-time signature slot) |

Total capacity: 64 × 64 × 64 = **262,144 one-time signatures per address**.

---

## Building from source

```bash
# Install all workspace dependencies
pnpm install

# Build a specific package
pnpm --filter @totemsdk/core build

# Build all packages
pnpm -r build

# Run tests
pnpm -r test
```

---

## Documentation

| Document | Description |
|----------|-------------|
| [INTEGRATION_GUIDE.md](packages/core/docs/INTEGRATION_GUIDE.md) | Server-side verification, hex conventions, TreeSignature format, replay protection |
| [CHANGELOG.md](CHANGELOG.md) | Full version history |
| [SDK_AUDIT.md](docs/SDK_AUDIT.md) | Package audit, status, and parity gap table |

---

## License

MIT — see [LICENSE](LICENSE) for details.

## Support

- Documentation: https://docs.axia.to
- GitHub Issues: https://github.com/axia-global/minima-sdk/issues
