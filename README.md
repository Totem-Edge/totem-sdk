# Totem SDK

> **The sovereign toolkit for the Minima network.** Cryptographic primitives, KISSVM scripting, recursive MAST policy trees, payment channels, edge computing, on-chain governance, verifiable claims, and AI agent policies — all quantum-resistant, all modular, all open-source.

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![NPM](https://img.shields.io/npm/v/@totemsdk/core?label=core)](https://www.npmjs.com/package/@totemsdk/core)
[![NPM](https://img.shields.io/npm/v/@totemsdk/kissvm?label=kissvm)](https://www.npmjs.com/package/@totemsdk/kissvm)
[![NPM](https://img.shields.io/npm/v/@totemsdk/edge?label=edge)](https://www.npmjs.com/package/@totemsdk/edge)

---

**I want to…** &nbsp; [Understand the vision](#the-vision) · [See the architecture](#architecture) · [Install and start coding](#quick-start) · [Browse all packages](#package-catalog) · [Read the docs](docs/README.md) · [Learn about Edge DeFi](docs/building-eefi-with-totem-edge.md) · [Contribute](#contributing) · [Report a security issue](SECURITY.md)

---

## The vision

The internet connected computers. Blockchains connected value. But neither connected the physical world — the sensors, machines, robots, buildings, and supply chains that actually produce and consume value — in a way that is cryptographically provable, institutionally composable, and free of centralised infrastructure.

Totem SDK is the connective tissue between three worlds that have never spoken the same language:

1. **The physical world** — PLCs, temperature sensors, robot arms, HVAC systems, BLE beacons, LoRaWAN soil monitors, CAN bus engine controllers, Matter smart locks, OPC-UA factory floors, BACnet building controllers, ROS 2 autonomous platforms.

2. **The institutional world** — governments, agencies, regulators, auditors, supply chain verifiers, identity issuers, compliance frameworks, cross-border trust agreements.

3. **The cryptographic world** — quantum-resistant WOTS signatures, Merkle proof trees, eltoo payment channels, state chains, verifiable credentials, recursive policy spaces.

The SDK doesn't just bridge these worlds. It makes them **composable** — a sensor reading from a Modbus PLC in a German factory can flow through a recursive MAST policy tree that verifies the device's identity, checks the operator's delegated authority, validates the reading against a compliance pipeline, and settles payment through an Omnia channel, all without a single centralised server in the loop.

---

## Why Totem SDK?

Most blockchain SDKs give you a wallet and a JSON-RPC client. Totem SDK gives you **an entire platform** — 55+ packages spanning five architectural domains, from quantum-resistant cryptography to AI agent policy enforcement. You pick the pieces you need and leave the rest.

**The problem:** Building on Minima today means hand-rolling WOTS+ signature management, writing KISSVM scripts from scratch, managing payment channel state machines, and figuring out how to connect sensors and gateways to the chain. Every team solves these problems independently, wasting time on infrastructure instead of building their product.

**The solution:** Totem SDK is a **modular framework** where each package solves one problem well. Need quantum-resistant signatures? `@totemsdk/core`. Need a payment channel? `@totemsdk/omnia`. Need to run an MQTT gateway for industrial sensors? `@totemsdk/edge-mqtt`. They compose because they share the same cryptographic foundation, the same type system, and the same design philosophy: **determinism, sovereignty, and quantum-resistance by default.**

### What makes it different

- **Rust/WASM under the hood.** The cryptographic core (`core-wasm`), the KISSVM evaluator (`kissvm`), and the edge MQTT helpers (`edge-mqtt`) are all compiled from Rust to WebAssembly. You get native performance with zero native dependencies.
- **Quantum-resistant from day one.** WOTS+ signatures with 256-bit security against both classical and quantum adversaries. No ECDSA, no Ed25519, no upgrade path needed later.
- **Sovereign by design.** Every package can run on your own hardware — your own lookup node, your own statechain entity server, your own channel factory. No cloud dependency, no trusted third party.
- **AI-ready.** The `agent-policy` package defines a Protobuf-based contract between AI agents and wallets. Agents propose, humans sign. The agent never holds a private key.

---

## Architecture

The SDK is organised in layers. Each layer builds on the one below it. Each layer is independently usable. Each layer is transport-agnostic — no package imports a network library.

```
┌─────────────────────────────────────────────────────────────┐
│                    EDGE DEVICE LAYER                         │
│  edge-mqtt  edge-modbus  edge-grpc  edge-coap  edge-can     │
│  edge-ble   edge-lorawan  edge-ros2  edge-opcua             │
│  edge-bacnet  edge-matter  edge-email  edge-adapters        │
│                                                             │
│  Every protocol. Every device. One runtime.                 │
├─────────────────────────────────────────────────────────────┤
│                    GOVERNANCE LAYER                          │
│  recursive-mast  authority  agent-policy  governance        │
│                                                             │
│  Nested MAST policy trees. Delegated authority chains.      │
│  Cross-domain trust bridges. Migration paths.               │
│  PREVSTATE state machines. Compliance pipelines.            │
│  On-chain voting, liquid democracy, quadratic voting.       │
├─────────────────────────────────────────────────────────────┤
│                    APPLICATION LAYER                         │
│  omnia  omnia-router  omnia-splice  omnia-factory           │
│  omnia-vtxo  statechain  proof  proof-integritas            │
│  proofgraph  identity  manifest  connect                    │
│  industrial-action  liquidity-bond  provider-bond           │
│                                                             │
│  Payment channels. Multi-hop routing. State chains.         │
│  Verifiable credentials. dApp gateway.                      │
│  Industrial action lifecycle. Reputation bonds.             │
├─────────────────────────────────────────────────────────────┤
│                    INFRASTRUCTURE LAYER                      │
│  lookup-node  lookup-client  lookup-protocol                │
│  chain-provider  pureminima-rpc  realtime  server           │
│  stream-transport  pubsub-transport  pear  mcp-server       │
│                                                             │
│  Personal chain indexers. P2P relay. Hyperswarm DHT.        │
│  WebSocket streaming. Self-sovereign infrastructure.        │
│  MCP server for AI agent tooling.                           │
├─────────────────────────────────────────────────────────────┤
│                    CRYPTOGRAPHIC LAYER                       │
│  core  core-wasm  wots-lease  txpow  tx-builder  kissvm     │
│  root-identity  se-server  wallet-adapter                  │
│                                                             │
│  WOTS TreeKeys. BIP39 seeds. TxPoW mining.                  │
│  KISSVM smart contracts. MMR proofs.                        │
│  Quantum-resistant from the ground up.                      │
└─────────────────────────────────────────────────────────────┘
```

---

## Package catalog

### Cryptographic layer

| Package | Description |
|---------|-------------|
| [`@totemsdk/core`](packages/core) | The cryptographic engine — WOTS, TreeKey, BIP39, MMR, serialization, WASM-backed |
| [`@totemsdk/core-wasm`](packages/core-wasm) | Rust/WASM core — WOTS+ signatures, SHA3-256, TreeKey, TxPoW mining, BIP39 (~2,720 lines of Rust) |
| [`@totemsdk/wots-lease`](packages/wots-lease) | WOTS key safety — atomic reservation, hash-chained journal, crash recovery, prevents catastrophic signature slot reuse |
| [`@totemsdk/txpow`](packages/txpow) | TxPoW — Minima's spam-prevention proof-of-work on every transaction |
| [`@totemsdk/tx-builder`](packages/tx-builder) | Construct Minima transactions in pure TypeScript with verified multisig |
| [`@totemsdk/kissvm`](packages/kissvm) | KISSVM v1 evaluator — Minima's smart contract language, Rust/WASM-backed (~1,800 lines of Rust) |
| [`@totemsdk/root-identity`](packages/root-identity) | One seed → up to 64 blockchain addresses, all cryptographically provable |
| [`@totemsdk/se-server`](packages/se-server) | Statechain Entity server — blind co-signatures for off-chain UTXO custody |
| [`@totemsdk/wallet-adapter`](packages/wallet-adapter) | Wallet adapter interfaces for multi-provider chain access |

### Infrastructure layer

| Package | Description |
|---------|-------------|
| [`@totemsdk/lookup-node`](packages/lookup-node) | Run your own always-on personal lookup node — chain indexer, relay, app registry on Hyperswarm |
| [`@totemsdk/lookup-client`](packages/lookup-client) | Connect to your personal lookup node from any app |
| [`@totemsdk/lookup-protocol`](packages/lookup-protocol) | Wire protocol spec for the P2P lookup network with frame-size limits |
| [`@totemsdk/chain-provider`](packages/chain-provider) | Unified abstraction over all chain data sources — hosted, PureMinima RPC, lookup node |
| [`@totemsdk/pureminima-rpc`](packages/pureminima-rpc) | Direct RPC to a self-hosted PureMinima node — TLS by default, value-sanitised |
| [`@totemsdk/realtime`](packages/realtime) | Live balance streaming with WebSocket and HTTP fallback |
| [`@totemsdk/server`](packages/server) | Server-side utilities — Axia API client with RPC sanitisation |
| [`@totemsdk/stream-transport`](packages/stream-transport) | Bidirectional byte-stream adapters — WebSocket, Hyperswarm, WebRTC, stdio, in-memory |
| [`@totemsdk/pubsub-transport`](packages/pubsub-transport) | Publish-subscribe transport abstractions — MQTT-compatible, protocol-agnostic |
| [`@totemsdk/pear`](packages/pear) | Run Totem SDK apps inside Holepunch's Pear/Bare runtime — zero servers |
| [`@totemsdk/mcp-server`](packages/mcp-server) | MCP server for AI agent tooling — expose SDK capabilities to LLM-powered agents |

### Application layer

| Package | Description |
|---------|-------------|
| [`@totemsdk/omnia`](packages/omnia) | Eltoo payment channels — the heart of Totem's payment network, with funding verification and counterparty signature checks |
| [`@totemsdk/omnia-router`](packages/omnia-router) | Multi-hop payments and cross-token swaps across the channel network |
| [`@totemsdk/omnia-splice`](packages/omnia-splice) | Resize channels without closing them — splice-in and splice-out |
| [`@totemsdk/omnia-factory`](packages/omnia-factory) | Scale payment channels — N-of-N funded factory channels with virtual channel support |
| [`@totemsdk/omnia-vtxo`](packages/omnia-vtxo) | VTXO management for Omnia channels — Merkle-verified exit proofs |
| [`@totemsdk/statechain`](packages/statechain) | Off-chain UTXO ownership transfer using the Mercury protocol with blind SE co-signatures |
| [`@totemsdk/proof`](packages/proof) | Portable proof layer — create, sign, verify, and anchor WOTS-signed proof envelopes |
| [`@totemsdk/proof-integritas`](packages/proof-integritas) | Integritas v2 proof-of-existence — hash stamping and on-chain verification |
| [`@totemsdk/proofgraph`](packages/proofgraph) | Local deterministic proof relationship graph — content-addressed DAG of proofs, identities, and manifests |
| [`@totemsdk/identity`](packages/identity) | Canonical identity and claims layer — who controls a manifest, device, or agent |
| [`@totemsdk/manifest`](packages/manifest) | Service manifests and KISSVM contract/covenant declarations |
| [`@totemsdk/connect`](packages/connect) | The dApp gateway — everything a web app needs to talk to the Totem extension |
| [`@totemsdk/industrial-action`](packages/industrial-action) | Industrial action lifecycle — orchestrate multi-step industrial workflows with on-chain settlement |
| [`@totemsdk/liquidity-bond`](packages/liquidity-bond) | Liquidity bonds — stake-based reputation and liquidity provisioning for the payment network |
| [`@totemsdk/provider-bond`](packages/provider-bond) | Provider reputation bonds — bond-based trust for service providers in the Totem network |

### Governance layer

| Package | Description |
|---------|-------------|
| [`@totemsdk/recursive-mast`](packages/recursive-mast) | Nested MAST + PREVSTATE library — policy trees, proof chains, delegation, cross-domain trust, migration paths, state machines, compliance pipelines |
| [`@totemsdk/authority`](packages/authority) | Deterministic authority engine — mandate verification, scope matching, usage tracking |
| [`@totemsdk/agent-policy`](packages/agent-policy) | The interface seam between human wallets and AI agents — Protobuf-specified policy contracts |
| [`@totemsdk/governance`](packages/governance) | On-chain governance — quadratic voting, liquid democracy, delegation, DAO primitives |

### Edge device layer

| Package | Protocol | Use case |
|---------|----------|----------|
| [`@totemsdk/edge`](packages/edge) | — | Unified edge runtime — port injection, capability model, device identity |
| [`@totemsdk/edge-adapters`](packages/edge-adapters) | — | Reference adapters bridging SDK packages to Edge port interfaces, including stream and pubsub |
| [`@totemsdk/edge-mqtt`](packages/edge-mqtt) | MQTT | Sensors, gateways, MachinePay — rule engine, sensor bridge, proof publisher, command handler |
| [`@totemsdk/edge-modbus`](packages/edge-modbus) | Modbus TCP/RTU | PLCs, RTUs, industrial sensors — coil/register read, automated polling |
| [`@totemsdk/edge-grpc`](packages/edge-grpc) | gRPC | Service-to-service, cloud-to-edge control planes — unary calls over streams |
| [`@totemsdk/edge-coap`](packages/edge-coap) | CoAP (RFC 7252) | Constrained devices — CON/NON/ACK/RST, UDP transport, resource observation |
| [`@totemsdk/edge-can`](packages/edge-can) | CAN bus | Automotive, heavy machinery — DBC signal decoding, socketcan |
| [`@totemsdk/edge-ble`](packages/edge-ble) | BLE | Wearables, beacons, proximity — GATT services, scanning, notifications |
| [`@totemsdk/edge-lorawan`](packages/edge-lorawan) | LoRaWAN | Agriculture, asset tracking — OTAA/ABP, confirmed/unconfirmed uplink |
| [`@totemsdk/edge-ros2`](packages/edge-ros2) | ROS 2 | Robotics — DDS middleware, typed topics, service calls |
| [`@totemsdk/edge-opcua`](packages/edge-opcua) | OPC-UA | SCADA, factory floors — secure channel, node browsing, monitored items |
| [`@totemsdk/edge-bacnet`](packages/edge-bacnet) | BACnet | Building automation, HVAC — device discovery, COV subscriptions |
| [`@totemsdk/edge-matter`](packages/edge-matter) | Matter | Smart home — commissioning, fabric management, attribute subscriptions |
| [`@totemsdk/edge-email`](packages/edge-email) | SMTP/IMAP | Email-triggered actions — send proofs, receive commands, notification pipelines |

---

## How the layers compose

A concrete example. A temperature sensor on a Modbus PLC in a German factory:

```
┌──────────────────────────────────────────────────────────────┐
│ 1. EDGE LAYER                                                │
│    edge-modbus polls the PLC every 5 seconds.                │
│    Reading: 23.5°C at unit 1, address 0.                    │
├──────────────────────────────────────────────────────────────┤
│ 2. GOVERNANCE LAYER                                          │
│    recursive-mast verifies:                                  │
│      • Device is in the factory's policy tree (MAST proof)   │
│      • Operator has delegated authority (delegation chain)    │
│      • Reading passes compliance pipeline (4-stage PROOF)     │
│      • State machine allows this transition (PREVSTATE)       │
├──────────────────────────────────────────────────────────────┤
│ 3. APPLICATION LAYER                                         │
│    proof creates a WOTS-signed proof envelope.               │
│    identity binds the proof to the device's DID.             │
│    omnia settles payment for the verified reading.           │
├──────────────────────────────────────────────────────────────┤
│ 4. INFRASTRUCTURE LAYER                                      │
│    lookup-node indexes the proof for audit.                  │
│    chain-provider confirms the settlement on-chain.           │
│    stream-transport carries the data over Hyperswarm.        │
├──────────────────────────────────────────────────────────────┤
│ 5. CRYPTOGRAPHIC LAYER                                       │
│    core provides WOTS signatures, SHA3-256 hashing.           │
│    wots-lease ensures no key is ever reused.                 │
│    kissvm evaluates the compliance pipeline script.           │
└──────────────────────────────────────────────────────────────┘
```

Every step is cryptographically provable. Every step is transport-agnostic. Every step is quantum-resistant. No centralised server required.

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

# Edge computing: MQTT + protocol-specific connector (install only what you need)
pnpm add @totemsdk/edge @totemsdk/edge-mqtt @totemsdk/edge-bacnet

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

### Wire up a Modbus PLC

```ts
import { createEdgeRuntime, createEdgeDevice, createCapabilitySet } from '@totemsdk/edge';
import { createModbusGateway, createModbusSensorBridge } from '@totemsdk/edge-modbus';
import { createStreamPortAdapter } from '@totemsdk/edge-adapters';
import { buildSensorFleetPolicy } from '@totemsdk/recursive-mast/templates/sensor-proof';
import type { ModbusTransportPort } from '@totemsdk/edge-modbus';

// 1. Implement the transport (your Modbus library here)
const transport: ModbusTransportPort = { /* ... */ };

// 2. Create the Edge runtime
const runtime = createEdgeRuntime({
  deviceId: 'factory-plc-01',
  capabilities: createCapabilitySet(['transport:modbus', 'proof:create']),
  ports: { /* proof port from edge-adapters */ },
});

// 3. Create the gateway
const gateway = createModbusGateway({ runtime, transport });
await gateway.start();

// 4. Read registers
const result = await gateway.readRegisters(1, 0, 10);

// 5. Or use the sensor bridge for automated polling + proof generation
const bridge = createModbusSensorBridge({
  runtime, transport, gateway,
  bindings: [
    { sensorId: 'temp-zone-1', unitId: 1, functionCode: 3, address: 0, count: 2, intervalMs: 5000, dataType: 'temperature', unit: '°C' },
  ],
});
await bridge.start();
```

### Build a policy tree

```ts
import { buildPolicyTree, getPolicyPath } from '@totemsdk/recursive-mast';

const tree = buildPolicyTree([
  { id: 'national', name: 'National Authority', script: 'RETURN TRUE' },
  { id: 'regional', name: 'Regional Office', script: 'ASSERT SIGNEDBY(STATE(0)) RETURN TRUE', parentId: 'national' },
  { id: 'local', name: 'Local Branch', script: 'ASSERT SIGNEDBY(PREVSTATE(0)) RETURN TRUE', parentId: 'regional' },
]);

const path = getPolicyPath(tree, 'local');
// [national, regional, local]
```

### Build a PREVSTATE state machine

```ts
import { onOffStateMachine, buildStateMachineScript } from '@totemsdk/recursive-mast/templates/state-machine';

const machine = onOffStateMachine(0, '0xABCD...');
const script = buildStateMachineScript(machine);
// KISSVM script that enforces OFF → ON → OFF transitions
```

---

## Key design principles

### Transport agnosticism

No package in this SDK imports a network library. Not `mqtt.js`, not `modbus-serial`, not `socketcan`, not `noble`, not `rclnodejs`, not `node-opcua`, not `node-bacnet`, not the Matter SDK. Every protocol adapter defines a **transport port interface** — a clean contract that the caller implements for their environment. This means the same package works in Node.js, Bun, the browser, Bare, Pear, or any runtime that can provide the transport.

### Quantum resistance

Every signing operation flows through WOTS TreeKeys — a 3-level hierarchical tree providing 262,144 one-time signatures per address. The `wots-lease` system prevents the one fatal mistake (key reuse) through atomic reservation, hash-chained journaling, and crash recovery. `root-identity` turns this into a usable multi-address identity system.

### Sovereignty

`lookup-node` + `lookup-client` + `lookup-protocol` form a personal decentralised infrastructure layer. Run your own chain indexer, relay, and app registry on Hyperswarm without relying on any Totem/Axia servers. Your data, your proofs, your infrastructure.

### Composable governance

`recursive-mast` implements nested MAST — proof-authenticated dynamic loading of bounded executable modules. A MAST statement references a Merkle/MMR root; the transaction witness supplies a script + proof resolving to that root. The loaded script executes in the same contract context and may itself contain another MAST statement referencing a different root. This enables:

- **Hierarchical governance** — National → Regional → Institutional → Local rules
- **Delegated authority chains** — Government → Agency → Department → Officer
- **Verification pipelines** — Schema validation → Issuer verification → Revocation check → Attribute proof
- **Cross-domain trust** — One country's identity system → Another country's acceptance rules
- **Upgradeable systems** — Old policy → Migration policy → New policy

### PREVSTATE state machines

Minima's `PREVSTATE(port)` opcode reads the previous transaction's state variable, enabling stateful contracts that evolve across transactions. `recursive-mast` provides ready-to-use templates: counters, vesting schedules, round-based games, timelocks, on/off state machines, HVAC modes, production line states, and robot arm kinematics — all enforced by KISSVM scripts that run on-chain.

---

## Technology stack

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

## Monorepo structure

```
packages/                   # 55+ SDK packages (the platform)
├── core/                   # Cryptographic primitives (WOTS+, MMR, etc.)
├── core-wasm/              # Rust/WASM crypto engine
├── kissvm/                 # KISSVM evaluator + template library
├── omnia/                  # Eltoo payment channels
├── edge/                   # Edge device runtime
├── edge-modbus/            # Modbus protocol adapter
├── edge-mqtt/              # MQTT sensor bridge + MachinePay
├── mcp-server/             # MCP server for AI agent tooling
├── governance/             # On-chain governance (voting, DAO)
├── recursive-mast/         # Nested MAST policy trees + PREVSTATE
├── industrial-action/      # Industrial action lifecycle
└── ... (44 more)

extensions/                 # Non-SDK applications
├── totem-extension/        # Chrome MV3 browser extension wallet
├── totem-pwa-wallet/       # Progressive web app wallet
├── totem-dapp-starter/     # dApp starter template
├── totem-pear-android-starter/  # Android Pear runtime starter
└── observability/          # Telemetry and monitoring

docs/                       # SDK documentation
├── kissvm/                 # KISSVM docs (template catalog, reference)
├── totem-agent/            # AI agent integration docs
├── rfc/                    # RFCs and upgrade proposals
└── ...
```

---

## Documentation

| Document | Description |
|----------|-------------|
| [KISSVM Guide](packages/kissvm/docs/KISSVM_Comprehensive_Guide.md) | Full KISSVM language reference, opcodes, templates |
| [KISSVM Reference](packages/kissvm/docs/REFERENCE.md) | Quick-reference card for KISSVM syntax and opcodes |
| [KISSVM Templates](packages/kissvm/docs/TEMPLATES.md) | Ready-to-use KISSVM script templates |
| [Integration Guide](packages/core/docs/INTEGRATION_GUIDE.md) | Server-side verification, hex conventions, TreeSignature format, replay protection |
| [Core Yellow Paper](TOTEM_CORE_YELLOW_PAPER.md) | Full WOTS+ and TreeKey cryptographic specification, including lease and watermark coordination |
| [Connect Red Paper](TOTEM_CONNECT_RED_PAPER.md) | Totem Connect dApp-wallet protocol specification — all 49 methods |
| [Omnia Blue Paper](TOTEM_OMNIA_BLUE_PAPER.md) | P2P payment channels, routing, factories, VTXOs, statechains — scaling to billions of devices |
| [Governance Green Paper](TOTEM_GOVERNANCE_GREEN_PAPER.md) | Authority mandates, recursive MAST policy trees, quadratic voting, liquid democracy, QVAC agent policy |
| [Edge Grey Paper](TOTEM_EDGE_GREY_PAPER.md) | Port-injected, transport-agnostic edge runtime — protocol adapters, MachinePay, offline operation |
| [Tokenomics Gold Paper](TOTEM_TOKENOMICS_GOLD_PAPER.md) | Two-asset model: MINIMA as collateral backbone, TOTEM as service revenue token |
| [SDK Audit](docs/SDK_AUDIT.md) | Package audit, status, and parity gap table |
| [SDK Manifest](SDK_MANIFEST.json) | Machine-readable package index — for AI agents, tooling, and dependency analysis |
| [API Reference](https://totem.ing) | Full TypeDoc-generated API reference |
| [CHANGELOG.md](CHANGELOG.md) | Full version history |

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

### Building from source

```bash
pnpm install
pnpm -r build
pnpm -r test
```

### Running tests

```bash
pnpm test             # SDK unit tests
pnpm test:extension   # Extension tests
```

### Building Rust/WASM packages

```bash
# Install Rust + wasm-pack (one-time)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
cargo install wasm-pack

# Build a specific WASM package
cd packages/kissvm
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
