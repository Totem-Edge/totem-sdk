# Totem SDK

**A modular, quantum-resistant, decentralised operating system for connecting devices, people, and institutions — on and off the Minima blockchain.**

---

## The vision

The internet connected computers. Blockchains connected value. But neither connected the physical world — the sensors, machines, robots, buildings, and supply chains that actually produce and consume value — in a way that is cryptographically provable, institutionally composable, and free of centralised infrastructure.

Totem SDK is the connective tissue between three worlds that have never spoken the same language:

1. **The physical world** — PLCs, temperature sensors, robot arms, HVAC systems, BLE beacons, LoRaWAN soil monitors, CAN bus engine controllers, Matter smart locks, OPC-UA factory floors, BACnet building controllers, ROS 2 autonomous platforms.

2. **The institutional world** — governments, agencies, regulators, auditors, supply chain verifiers, identity issuers, compliance frameworks, cross-border trust agreements.

3. **The cryptographic world** — quantum-resistant WOTS signatures, Merkle proof trees, eltoo payment channels, state chains, verifiable credentials, recursive policy spaces.

The SDK doesn't just bridge these worlds. It makes them **composable** — a sensor reading from a Modbus PLC in a German factory can flow through a recursive MAST policy tree that verifies the device's identity, checks the operator's delegated authority, validates the reading against a compliance pipeline, and settles payment through an Omnia channel, all without a single centralised server in the loop.

---

## Architecture

The SDK is organised in layers. Each layer builds on the one below it. Each layer is independently usable. Each layer is transport-agnostic — no package imports a network library.

```
┌─────────────────────────────────────────────────────────────┐
│                    EDGE DEVICE LAYER                         │
│  edge-mqtt  edge-modbus  edge-grpc  edge-coap  edge-can     │
│  edge-ble   edge-lorawan  edge-ros2  edge-opcua             │
│  edge-bacnet  edge-matter  edge-adapters                    │
│                                                             │
│  Every protocol. Every device. One runtime.                 │
├─────────────────────────────────────────────────────────────┤
│                    GOVERNANCE LAYER                          │
│  recursive-mast  authority  agent-policy                    │
│                                                             │
│  Nested MAST policy trees. Delegated authority chains.      │
│  Cross-domain trust bridges. Migration paths.               │
│  PREVSTATE state machines. Compliance pipelines.            │
├─────────────────────────────────────────────────────────────┤
│                    APPLICATION LAYER                         │
│  omnia  omnia-router  omnia-splice  omnia-factory           │
│  omnia-vtxo  statechain  proof  proof-integritas            │
│  proofgraph  identity  manifest  connect                    │
│                                                             │
│  Payment channels. Multi-hop routing. State chains.         │
│  Verifiable credentials. dApp gateway.                      │
├─────────────────────────────────────────────────────────────┤
│                    INFRASTRUCTURE LAYER                      │
│  lookup-node  lookup-client  lookup-protocol                │
│  chain-provider  pureminima-rpc  realtime  server           │
│  stream-transport  pubsub-transport  pear                   │
│                                                             │
│  Personal chain indexers. P2P relay. Hyperswarm DHT.        │
│  WebSocket streaming. Self-sovereign infrastructure.        │
├─────────────────────────────────────────────────────────────┤
│                    CRYPTOGRAPHIC LAYER                       │
│  core  wots-lease  txpow  tx-builder  kissvm                │
│  root-identity  se-server  wallet-adapter                   │
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
| [`@totemsdk/wots-lease`](packages/wots-lease) | WOTS key safety — atomic reservation, hash-chained journal, crash recovery, prevents catastrophic signature slot reuse |
| [`@totemsdk/txpow`](packages/txpow) | TxPoW — Minima's spam-prevention proof-of-work on every transaction |
| [`@totemsdk/tx-builder`](packages/tx-builder) | Construct Minima transactions in pure TypeScript with verified multisig |
| [`@totemsdk/kissvm`](packages/kissvm) | KISSVM v1 evaluator — Minima's smart contract language, Rust/WASM-backed |
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

### Governance layer

| Package | Description |
|---------|-------------|
| [`@totemsdk/recursive-mast`](packages/recursive-mast) | Nested MAST + PREVSTATE library — policy trees, proof chains, delegation, cross-domain trust, migration paths, state machines, compliance pipelines |
| [`@totemsdk/authority`](packages/authority) | Deterministic authority engine — mandate verification, scope matching, usage tracking |
| [`@totemsdk/agent-policy`](packages/agent-policy) | The interface seam between human wallets and AI agents — Protobuf-specified policy contracts |

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

## Getting started

```bash
# Install the packages you need
npm install @totemsdk/core @totemsdk/edge @totemsdk/edge-modbus

# Or the full suite
npm install @totemsdk/core @totemsdk/edge @totemsdk/edge-adapters @totemsdk/recursive-mast
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

## Building from source

```bash
pnpm install
pnpm -r build
pnpm -r test
```

---

## Documentation

| Document | Description |
|----------|-------------|
| [INTEGRATION_GUIDE.md](packages/core/docs/INTEGRATION_GUIDE.md) | Server-side verification, hex conventions, TreeSignature format, replay protection |
| [CHANGELOG.md](CHANGELOG.md) | Full version history |
| [SDK_AUDIT.md](docs/SDK_AUDIT.md) | Package audit, status, and parity gap table |
| [edge-adapters/docs/edge-protocol-adapters-plan.md](packages/edge-adapters/docs/edge-protocol-adapters-plan.md) | Edge protocol adapter implementation plan |

---

## License

MIT
