# Totem SDK

**The open-source implementation of Totem Edge — verifiable infrastructure for Physical AI.**

Sensors read the world, machines act on it, and value moves because of it. Totem SDK is a modular TypeScript/Rust toolkit for building that loop so that **every step is cryptographically provable** — a signature, an anchored proof, a policy evaluation, a settled payment — with no central application cloud and no trusted third party in the loop.

> For the strategic overview (the loop, the five systems, and why this exists), see the [Totem Edge org README](.github/profile/README.md). This file is the technical one: what's here, how it's organised, and how to use it.

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![NPM](https://img.shields.io/npm/v/@totemsdk/core?label=core)](https://www.npmjs.com/package/@totemsdk/core)
[![NPM](https://img.shields.io/npm/v/@totemsdk/kissvm?label=kissvm)](https://www.npmjs.com/package/@totemsdk/kissvm)
[![NPM](https://img.shields.io/npm/v/@totemsdk/edge?label=edge)](https://www.npmjs.com/package/@totemsdk/edge)

---

**I want to…** &nbsp; [Understand the loop](#the-loop) · [See the five systems](#the-five-systems) · [Browse the packages](#package-catalog) · [Install and start coding](#quick-start) · [Read the docs](docs/README.md) · [Contribute](#contributing) · [Report a security issue](SECURITY.md)

---

## The loop

Physical systems don't work in "transactions". They work in loops:

**Sense → Prove → Decide → Act → Settle**

| Stage | What happens | Serious packages |
|-------|--------------|------------------|
| **Sense** | A device reads the world — temperature, pressure, energy, motion. | `edge-*` protocol adapters (MQTT, Modbus, BACnet, CAN, BLE, LoRaWAN, OPC-UA, ROS 2, Matter, CoAP, gRPC, SMTP/IMAP) |
| **Prove** | The reading becomes a signed, anchored, verifiable fact. | `core` (WOTS+ signatures), `root-identity`, `proof`, `proofgraph`, `manifest` |
| **Decide** | Policy evaluates whether the fact is acceptable. | `recursive-mast`, `authority`, `governance`, `agent-policy`, `kissvm` |
| **Act** | Bounded operational action against a real device. | `edge`, `industrial-action`, `edge-adapters` |
| **Settle** | Value moves — micropayments, balances, dividends. | `omnia`, `omnia-router`, `omnia-factory`, `statechain`, `liquidity-bond` |

Each stage produces evidence consumed by the next, and the evidence is produced by open-source code you can run yourself.

## The five systems

The SDK is organised into five systems that map onto the loop — plus a cryptographic foundation everything sits on:

| System | Covers | Example packages |
|--------|--------|------------------|
| **Settlement** | Payment channels and value movement | `omnia`, `omnia-router`, `omnia-splice`, `omnia-factory`, `omnia-vtxo`, `omnia-host`, `statechain`, `se-server`, `tx-builder`, `txpow`, `liquidity-bond`, `provider-bond` |
| **Trust** | Identity, signatures, proofs, anchoring | `core`, `core-wasm`, `wots-lease`, `root-identity`, `proof`, `proof-integritas`, `proofgraph`, `location-proof`, `spatial-proof`, `raster-proof`, `identity`, `manifest`, `connect` |
| **Policy** | Decisions, delegation, governance, agent seams | `recursive-mast`, `authority`, `governance`, `agent-policy` |
| **Action** | Bounded operational execution on devices | `edge`, `industrial-action`, `edge-adapters` |
| **Edge** | Protocol connectors for sensing | `edge-mqtt`, `edge-modbus`, `edge-bacnet`, `edge-ble`, `edge-can`, `edge-coap`, `edge-grpc`, `edge-lorawan`, `edge-matter`, `edge-opcua`, `edge-ros2`, `edge-email`, `pear` |
| **Foundation** | KISSVM, serialization, crypto primitives | `core`, `kissvm`, `core-wasm` |

Sovereignty infrastructure (`lookup-node`, `lookup-client`, `lookup-protocol`, `chain-provider`, `minima-rpc`, `pureminima-rpc`, `realtime`, `server`, `stream-transport`, `pubsub-transport`, `mcp-server`, `wallet-adapter`) is shared plumbing used by every system.

## What Totem does not assume

- **No central application cloud.** Can be deployed without dependence on a central application cloud — your own lookup node, your own channel factory, your own infrastructure.
- **No trusted third party.** Signatures are produced where the keys live; policy is evaluated by verifiable runtimes; proofs anchor on-chain.
- **No hardware brand loyalty.** Every protocol connector is transport-agnostic — you supply the transport, the logic stays identical.
- **No particular AI vendor.** Agents are separated from wallets by an explicit policy contract, not a proprietary integration.

## Bounded machine agency

Totem is built for systems where machines act autonomously — on a verifiable leash.

**AI proposes. Policy evaluates. Keys remain outside the agent.**

Agents never hold keys. An agent proposes a payment or an action; a policy engine evaluates it against scope, delegation, and budget; governed keys produce the signature. `agent-policy` defines the contract; `authority` and `recursive-mast` evaluate it; `industrial-action` bounds what acting on it can do.

## Why Minima?

Totem SDK is Minima-native, and we chose Minima because it fits the loop rather than fights it:

- **Hash-based signatures by construction.** WOTS+ one-time signatures are built from SHA3-256 — their security rests on the hash function, not on discrete-log or factoring assumptions, so they are a deliberate, from-scratch choice for a quantum future rather than a retrofit.
- **UTXO-native.** Value moves by spending coins, which composes naturally with channels, statechains, and vaults.
- **Scriptable at the protocol level.** KISSVM makes program invariants enforceable on-chain, so the deciding and settling stages are verifiable — not just wallet-side.
- **Runs on commodity hardware.** A personal node is small enough for a household or a factory edge box.

Minima is the default substrate; the SDK core is transport-agnostic, so the evidence layer speaks one language regardless of chain.

---

## Architecture

The five systems sit on a shared foundation. Each package is independently usable; each is transport-agnostic (no package imports a network library).

```
┌──────────────────────────────────────────────────────────────┐
│                 SETTLEMENT SYSTEM                              │
│  omnia  omnia-router  omnia-splice  omnia-factory             │
│  omnia-vtxo  omnia-host  statechain  se-server                │
│  tx-builder  txpow  liquidity-bond  provider-bond             │
│  Eltoo channels. Multi-hop routing. Statechains.              │
│  HTLC / vault / treasury / membership / asset programs.       │
├──────────────────────────────────────────────────────────────┤
│                  TRUST SYSTEM                                  │
│  core  core-wasm  wots-lease  root-identity  proof            │
│  proof-integritas  proofgraph  identity  manifest  connect    │
│  WOTS TreeKeys. MMR proofs. Verifiable credentials.           │
│  dApp gateway. Proof graph.                                   │
├──────────────────────────────────────────────────────────────┤
│                  POLICY SYSTEM                                 │
│  recursive-mast  authority  governance  agent-policy          │
│  Nested MAST policy trees. Delegated authority chains.        │
│  Quadratic voting. PREVSTATE state machines.                  │
├──────────────────────────────────────────────────────────────┤
│                  ACTION SYSTEM                                 │
│  edge  industrial-action  edge-adapters                       │
│  Port-injected runtime. Guardrailed operational actions.      │
├──────────────────────────────────────────────────────────────┤
│                  EDGE SYSTEM                                   │
│  edge-mqtt  edge-modbus  edge-grpc  edge-coap  edge-can       │
│  edge-ble  edge-lorawan  edge-ros2  edge-opcua  edge-bacnet   │
│  edge-matter  edge-email  pear                                │
│  One runtime. Protocol adapters at the port.                  │
├──────────────────────────────────────────────────────────────┤
│                  FOUNDATION                                    │
│  core  core-wasm  kissvm  tx-builder  txpow                   │
│  WOTS signatures. SHA3-256. KISSVM VM. TxPoW mining.          │
└──────────────────────────────────────────────────────────────┘
```

> **Port injection is the shallow-water test.** The edge runtime has no protocol code baked in. Every transport — MQTT, Modbus, BLE, CAN, e-mail, a proprietary vendor SDK — plugs into a port interface. One core that is auditable and identical everywhere; adapters that extend forever.

---

## A concrete loop: cold-chain proof-of-delivery

A refrigerated shipment of vaccines crosses a border. Nobody can run a central server in that truck.

1. **Sense** — an `edge-ble` or `edge-modbus` adapter reads temperature and door-open events from the reefer controller.
2. **Prove** — `edge` signs each reading with a WOTS TreeKey; `proof` wraps it in a WOTS-signed envelope; `proofgraph` links it to the shipment manifest.
3. **Decide** — `recursive-mast` evaluates the readings against the shipper's cold-chain policy (issuer → depot → carrier → auditor); `authority` checks the carrier's mandate covers this lane; `kissvm` enforces the temperature-range contract as a script.
4. **Act** — when a reading violates the range (or the manifest needs a proof-of-delivery push to the regulator), `industrial-action` runs the bounded, guardrailed operation on the edge.
5. **Settle** — `omnia` settles payment against the delivery event: full rate on verified cold-chain compliance, penalty rate on a proven breach, held in a channel balance until the proof audit completes.

Every stage produces evidence the next stage consumes — and every stage can be verified by any party who holds the public evidence.

---

## Package catalog

### Settlement system

| Package | Description |
|---------|-------------|
| [`@totemsdk/omnia`](packages/omnia) | Eltoo payment channels with 8 built-in channel programs (counter, meter, HTLC, vault, treasury, membership, asset) and a Rust/WASM parity engine |
| [`@totemsdk/omnia-host`](packages/omnia-host) | Durable Omnia node daemon — channel lifecycle, routing, and control APIs |
| [`@totemsdk/omnia-router`](packages/omnia-router) | Multi-hop payments and cross-token swaps across the channel network |
| [`@totemsdk/omnia-splice`](packages/omnia-splice) | Resize channels without closing them — splice-in and splice-out |
| [`@totemsdk/omnia-factory`](packages/omnia-factory) | Scale payment channels — N-of-N funded factory channels with virtual channel support |
| [`@totemsdk/omnia-vtxo`](packages/omnia-vtxo) | VTXO management for Omnia channels — Merkle-verified exit proofs |
| [`@totemsdk/statechain`](packages/statechain) | Off-chain UTXO ownership transfer using the Mercury protocol with blind SE co-signatures |
| [`@totemsdk/se-server`](packages/se-server) | Statechain Entity server — blind co-signatures for off-chain UTXO custody |
| [`@totemsdk/tx-builder`](packages/tx-builder) | Construct Minima transactions in pure TypeScript with verified multisig |
| [`@totemsdk/txpow`](packages/txpow) | TxPoW — Minima's spam-prevention proof-of-work on every transaction |
| [`@totemsdk/liquidity-bond`](packages/liquidity-bond) | Liquidity bonds — stake-based reputation and liquidity provisioning |
| [`@totemsdk/provider-bond`](packages/provider-bond) | Provider reputation bonds — bond-based trust for service providers |

### Trust system

| Package | Description |
|---------|-------------|
| [`@totemsdk/core`](packages/core) | The cryptographic engine — WOTS, TreeKey, BIP39, MMR, serialization, WASM-backed |
| [`@totemsdk/core-wasm`](packages/core-wasm) | Rust/WASM core — WOTS+ signatures, SHA3-256, TreeKey, TxPoW mining, BIP39 |
| [`@totemsdk/wots-lease`](packages/wots-lease) | WOTS key safety — atomic reservation, hash-chained journal, crash recovery |
| [`@totemsdk/root-identity`](packages/root-identity) | One seed → up to 64 blockchain addresses, all cryptographically provable |
| [`@totemsdk/proof`](packages/proof) | Portable proof layer — create, sign, verify, and anchor WOTS-signed proof envelopes |
| [`@totemsdk/proof-integritas`](packages/proof-integritas) | Integritas v2 proof-of-existence — hash stamping and on-chain verification |
| [`@totemsdk/proofgraph`](packages/proofgraph) | Local deterministic proof relationship graph — content-addressed DAG of proofs, identities, and manifests |
| [`@totemsdk/location-proof`](packages/location-proof) | Device-neutral location & movement proof primitives — GPS/GNSS claims, confidence scoring, motion trails, proof envelope integration |
| [`@totemsdk/spatial-proof`](packages/spatial-proof) | Generic spatial relationship proof primitives — geometry hashes, geofence relations (inside/covers/on-route/overlaps), proof envelope integration |
| [`@totemsdk/raster-proof`](packages/raster-proof) | Edge-capable raster & visual evidence proofs — asset hashes, tile Merkle roots, raster manifests, derived-layer provenance |
| [`@totemsdk/identity`](packages/identity) | Canonical identity and claims layer — who controls a manifest, device, or agent |
| [`@totemsdk/manifest`](packages/manifest) | Service manifests and KISSVM contract/covenant declarations |
| [`@totemsdk/connect`](packages/connect) | The dApp gateway — everything a web app needs to talk to the Totem extension |

### Policy system

| Package | Description |
|---------|-------------|
| [`@totemsdk/recursive-mast`](packages/recursive-mast) | Nested MAST + PREVSTATE library — policy trees, proof chains, delegation, state machines, compliance pipelines |
| [`@totemsdk/authority`](packages/authority) | Deterministic authority engine — mandate verification, scope matching, usage tracking |
| [`@totemsdk/agent-policy`](packages/agent-policy) | The interface seam between human wallets and AI agents — Protobuf-specified policy contracts |
| [`@totemsdk/governance`](packages/governance) | On-chain governance — quadratic voting, liquid democracy, delegation, DAO primitives |

### Action system

| Package | Description |
|---------|-------------|
| [`@totemsdk/edge`](packages/edge) | Unified edge runtime — port injection, capability model, device identity |
| [`@totemsdk/industrial-action`](packages/industrial-action) | Industrial action lifecycle — governed intent → guarded, verifiable operations on field devices |
| [`@totemsdk/edge-adapters`](packages/edge-adapters) | Reference adapters bridging SDK packages to Edge port interfaces |

### Edge system

| Package | Protocol | Use case |
|---------|----------|----------|
| [`@totemsdk/edge-mqtt`](packages/edge-mqtt) | MQTT | Sensors, gateways, MachinePay — rule engine, sensor bridge, proof publisher |
| [`@totemsdk/edge-modbus`](packages/edge-modbus) | Modbus TCP/RTU | PLCs, RTUs, industrial sensors — coil/register read, automated polling |
| [`@totemsdk/edge-bacnet`](packages/edge-bacnet) | BACnet | Building automation, HVAC — device discovery, COV subscriptions |
| [`@totemsdk/edge-ble`](packages/edge-ble) | BLE | Wearables, beacons, proximity — GATT services, scanning, notifications |
| [`@totemsdk/edge-can`](packages/edge-can) | CAN bus | Automotive, heavy machinery — DBC signal decoding, socketcan |
| [`@totemsdk/edge-coap`](packages/edge-coap) | CoAP (RFC 7252) | Constrained devices — CON/NON/ACK/RST, UDP transport |
| [`@totemsdk/edge-grpc`](packages/edge-grpc) | gRPC | Service-to-service, cloud-to-edge control planes |
| [`@totemsdk/edge-lorawan`](packages/edge-lorawan) | LoRaWAN | Agriculture, asset tracking — OTAA/ABP, confirmed/unconfirmed uplink |
| [`@totemsdk/edge-matter`](packages/edge-matter) | Matter | Smart home — commissioning, fabric management, attribute subscriptions |
| [`@totemsdk/edge-opcua`](packages/edge-opcua) | OPC-UA | SCADA, factory floors — secure channel, node browsing, monitored items |
| [`@totemsdk/edge-ros2`](packages/edge-ros2) | ROS 2 | Robotics — DDS middleware, typed topics, service calls |
| [`@totemsdk/edge-email`](packages/edge-email) | SMTP/IMAP | Email-triggered actions — send proofs, receive commands, sensor ingestion |
| [`@totemsdk/pear`](packages/pear) | — | Run Totem SDK apps inside Holepunch's Pear/Bare runtime |

### Foundation

| Package | Description |
|---------|-------------|
| [`@totemsdk/core`](packages/core) | The cryptographic engine — WOTS, TreeKey, BIP39, MMR, serialization, WASM-backed |
| [`@totemsdk/core-wasm`](packages/core-wasm) | Rust/WASM core — WOTS+ signatures, SHA3-256, TreeKey, TxPoW mining, BIP39 |
| [`@totemsdk/kissvm`](packages/kissvm) | KISSVM v1 evaluator — Minima's smart contract language, Rust/WASM-backed |

### Sovereignty infrastructure

| Package | Description |
|---------|-------------|
| [`@totemsdk/lookup-node`](packages/lookup-node) | Run your own always-on personal lookup node — chain indexer, relay, app registry |
| [`@totemsdk/lookup-client`](packages/lookup-client) | Connect to your personal lookup node from any app |
| [`@totemsdk/lookup-protocol`](packages/lookup-protocol) | Wire protocol spec for the P2P lookup network |
| [`@totemsdk/chain-provider`](packages/chain-provider) | Unified abstraction over all chain data sources — hosted, PureMinima RPC, lookup node |
| [`@totemsdk/minima-rpc`](packages/minima-rpc) | Direct RPC to a self-hosted Totem/Minima node — TLS by default |
| [`@totemsdk/pureminima-rpc`](packages/pureminima-rpc) | Fetch-based PureMinima RPC client — Bare/Pear/Node/browser compatible |
| [`@totemsdk/realtime`](packages/realtime) | Live balance streaming with WebSocket and HTTP fallback |
| [`@totemsdk/server`](packages/server) | Server-side utilities — Axia API client with RPC sanitisation |
| [`@totemsdk/stream-transport`](packages/stream-transport) | Bidirectional byte-stream adapters — WebSocket, Hyperswarm, WebRTC, stdio, in-memory |
| [`@totemsdk/pubsub-transport`](packages/pubsub-transport) | Publish-subscribe transport abstractions — MQTT-compatible |
| [`@totemsdk/mcp-server`](packages/mcp-server) | MCP server for AI agent tooling — expose SDK capabilities to LLM agents |
| [`@totemsdk/wallet-adapter`](packages/wallet-adapter) | Wallet adapter interfaces for multi-provider chain access |

The authoritative machine-readable catalog is [`SDK_MANIFEST.json`](SDK_MANIFEST.json) — currently **55 publishable packages** plus the private `@totem/sdk-tests`.

---

## Maturity

We are honest about where things stand. The core cryptographic layer and the Omnia channel state machine (including its Rust/WASM parity engine) are the most battle-tested; several edge connectors and governance/policy pieces are reference implementations proving the architecture.

| Layer | Status | Notes |
|-------|--------|-------|
| `core`, `core-wasm`, `kissvm` | **Production** | Extensive test vectors, Java byte-exact parity, WASM-backed |
| `omnia` (+ parity engine) | **Production** | 186 TS tests, 27 Rust tests, 11 WASM-parity suites; golden fixtures |
| `wots-lease` | **Stable** | Watermark v3 canonical; some provider backends still stubbed |
| `recursive-mast`, `authority`, `governance` | **Alpha → Beta** | Architecture-proven; broader policy templates in progress |
| `edge-*` connectors | **Reference** | Proven adapters (MQTT, Modbus); others demonstrate port injection |
| `industrial-action` | **Alpha** | Guardrail model defined; field hardening in progress |
| `omnia-host` | **Alpha** | Channel daemon; routing/control APIs active |

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

### Open an Omnia channel with a program

```typescript
import { createChannel, incrementCounter, getStateBigInt } from '@totemsdk/omnia';

const { channel } = await createChannel({
  localParty: alice,
  remoteParty: bob,
  localAmount: 100n,
  remoteAmount: 0n,
  program: { id: 'counter', version: 1 },
}, provider);

const { signedState } = await incrementCounter(channel, 5n, leaseProvider, signer);
const counter = getStateBigInt(signedState, 120);
```

### Wire up a Modbus PLC

```ts
import { createEdgeRuntime, createEdgeDevice, createCapabilitySet } from '@totemsdk/edge';
import { createModbusGateway, createModbusSensorBridge } from '@totemsdk/edge-modbus';
import type { ModbusTransportPort } from '@totemsdk/edge-modbus';

const transport: ModbusTransportPort = { /* your Modbus library here */ };

const runtime = createEdgeRuntime({
  deviceId: 'factory-plc-01',
  capabilities: createCapabilitySet(['transport:modbus', 'proof:create']),
  ports: { /* proof port from edge-adapters */ },
});

const gateway = createModbusGateway({ runtime, transport });
await gateway.start();

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

---

## Key design principles

### Transport agnosticism

No package in this SDK imports a network library. Every protocol adapter defines a **transport port interface** — a clean contract the caller implements for their environment. The same package works in Node.js, Bun, the browser, Bare, Pear, or any runtime that can provide the transport.

### Hash-based quantum resistance

Every signing operation flows through **WOTS+ (Winternitz One-Time Signatures)** — w=8, n=256, L=34 — built from SHA3-256 with a 3-level TreeKey hierarchy providing 262,144 one-time signatures per address. Because the security of WOTS+ rests on the one-wayness of the underlying hash rather than on discrete-log or factoring assumptions, the stack does not rely on any algorithm a large-scale quantum computer could retire. The one fatal failure mode — one-time key reuse — is handled by the `wots-lease` system: atomic reservation, hash-chained journaling, and crash recovery.

### Sovereignty

`lookup-node` + `lookup-client` + `lookup-protocol` form a personal decentralised infrastructure layer. Run your own chain indexer, relay, and app registry on Hyperswarm without relying on any Totem/Axia servers.

### Composable governance

`recursive-mast` implements nested MAST — proof-authenticated dynamic loading of bounded executable modules. A MAST statement references a Merkle/MMR root; the transaction witness supplies a script + proof resolving to that root. This enables hierarchical governance, delegated authority chains, verification pipelines, cross-domain trust, and upgradeable systems.

### PREVSTATE state machines

Minima's `PREVSTATE(port)` opcode reads the previous transaction's state variable, enabling stateful contracts that evolve across transactions. `recursive-mast` provides ready-to-use templates: counters, vesting schedules, round-based games, timelocks, on/off state machines, and production line states.

### Deterministic parity across runtimes

The channel state machine (`omnia`) is implemented in both TypeScript and Rust/WASM with **byte-identical behavior enforced by golden fixtures** — so a state transition signed in a browser and checked by a Rust verifier computes the same digest. The cryptographic core, KISSVM evaluator, and edge-MQTT helpers are likewise Rust/WASM-backed with TypeScript fallbacks.

---

## Technology stack

| Layer | Technology |
|-------|-----------|
| **Runtime** | Node.js, Browser, Bare, Pear (Android) |
| **Crypto engine** | Rust → WASM (`core-wasm`, `kissvm`, `edge-mqtt`) |
| **Hashing** | SHA3-256, SHA-256 (Rust `sha3` + `sha2` crates) |
| **P2P** | Hyperswarm, Hypercore, Hyperbee |
| **Package manager** | pnpm workspaces |
| **Language** | TypeScript (strict mode throughout) |

### Rust/WASM packages

| Package | Rust crate | Lines | What it does |
|---------|-----------|-------|-------------|
| `@totemsdk/core-wasm` | `totemsdk-core-wasm` | ~2,720 | WOTS+ signatures, SHA3-256, TreeKey, TxPoW mining, BIP39 |
| `@totemsdk/kissvm` | `kissvm-wasm` | ~1,800 | KISSVM v1 evaluator — lexer, parser, VM, all opcodes |
| `@totemsdk/edge-mqtt` | `edge-mqtt-wasm` | ~550 | Canonical JSON, MQTT topic matching, fixed-point arithmetic |
| `@totemsdk/omnia` | `omnia` | — | Channel state machine, programs, recovery, close-package validation |

Each package also ships a TypeScript fallback and a `wasm-sync.ts` bridge that provides a synchronous API over the async WASM loader.

---

## Security

### Key security properties

- **Hash-based signatures** — WOTS+ from SHA3-256; no discrete-log assumptions to break
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
packages/                   # 56 workspace packages, 55 publishable @totemsdk scoped
├── core/                   # Cryptographic primitives (WOTS+, MMR, etc.)
├── core-wasm/              # Rust/WASM crypto engine
├── kissvm/                 # KISSVM evaluator + template library
├── omnia/                  # Eltoo payment channels + 8 built-in programs
├── omnia/rust/             # Rust/WASM parity engine
├── edge/                   # Edge device runtime
├── edge-modbus/            # Modbus protocol adapter
├── edge-mqtt/              # MQTT sensor bridge + MachinePay
├── mcp-server/             # MCP server for AI agent tooling
├── governance/             # On-chain governance (voting, DAO)
├── recursive-mast/         # Nested MAST policy trees + PREVSTATE
├── industrial-action/      # Industrial action lifecycle
├── sdk-tests/              # Private integration + parity test package
└── ... (43 more packages)

extensions/                 # Non-SDK applications
├── totem-extension/        # Chrome MV3 browser extension wallet
├── totem-pwa-wallet/       # Progressive web app wallet
├── totem-dapp-starter/     # dApp starter template
├── totem-pear-android-starter/  # Android Pear runtime starter
└── observability/          # Telemetry and monitoring

docs/                       # SDK documentation
├── kissvm/                 # KISSVM docs (template catalog, reference)
├── totem-agent/            # AI agent integration docs
├── rfc/                    # RFCs and upgrade proposals (RFC-001/002/003)
└── ...
```

---

## Documentation

| Document | Description |
|----------|-------------|
| [Doc index](docs/README.md) | Canonical index of all SDK documentation |
| [KISSVM Guide](packages/kissvm/docs/KISSVM_Comprehensive_Guide.md) | Full KISSVM language reference, opcodes, templates |
| [KISSVM Reference](packages/kissvm/docs/REFERENCE.md) | Quick-reference card for KISSVM syntax and opcodes |
| [Integration Guide](packages/core/docs/INTEGRATION_GUIDE.md) | Server-side verification, hex conventions, TreeSignature format, replay protection |
| [Core Yellow Paper](TOTEM_CORE_YELLOW_PAPER.md) | Full WOTS+ and TreeKey cryptographic specification |
| [Connect Red Paper](TOTEM_CONNECT_RED_PAPER.md) | Totem Connect dApp-wallet protocol specification — all 49 methods |
| [Omnia Blue Paper](TOTEM_OMNIA_BLUE_PAPER.md) | P2P payment channels, routing, factories, VTXOs, statechains |
| [Governance Green Paper](TOTEM_GOVERNANCE_GREEN_PAPER.md) | Authority mandates, recursive MAST policy trees, quadratic voting |
| [Edge Grey Paper](TOTEM_EDGE_GREY_PAPER.md) | Port-injected, transport-agnostic edge runtime |
| [Tokenomics Gold Paper](TOTEM_TOKENOMICS_GOLD_PAPER.md) | Two-asset model: MINIMA collateral, TOTEM service token |
| [RFC-001](docs/rfc/RFC-001-SDK-UPGRADE.md) | SDK upgrade process |
| [RFC-002](docs/rfc/RFC-002-OMNIA-RUST-WASM-PARITY.md) | Omnia Rust/WASM channel parity (implemented) |
| [RFC-003](docs/rfc/RFC-003-OMNIA-BUILT-IN-PROGRAMS.md) | Omnia built-in channel programs (implemented) |
| [SDK Audit](docs/SDK_AUDIT.md) | Package audit, status, and parity table |
| [SDK Manifest](SDK_MANIFEST.json) | Machine-readable package index — 55 packages, for AI agents and tooling |
| [API Reference](https://totem.ing) | Full TypeDoc-generated API reference |

---

## Community

- **Website:** [https://totem.ing](https://totem.ing)
- **GitHub:** [github.com/Totem-Edge](https://github.com/Totem-Edge)
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

### Workspace verification gates

```bash
node scripts/verify-workspace.mjs --typecheck   # workspace-wide typecheck
node scripts/verify-workspace.mjs --test        # workspace-wide tests
node scripts/verify-workspace.mjs --lint        # workspace-wide lint
node scripts/verify-workspace.mjs --pack        # workspace-wide pack sanity
node scripts/verify-workspace.mjs --all         # run every gate in sequence
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

[Website](https://totem.ing) • [Documentation](https://totem.ing) • [GitHub](https://github.com/Totem-Edge)

</div>