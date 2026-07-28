# Totem Edge Runtime — Grey Paper

**The port-injected, transport-agnostic runtime that turns any physical device into a financially autonomous actor. Protocol adapters, MachinePay credit gating, offline operation, and the bridge between sensor readings and on-chain settlement.**

**Version:** 1.0
**Date:** 2026-07-28
**Status:** Active

---

## Table of Contents

1. [The Physical-Financial Bridge](#1-the-physical-financial-bridge)
2. [Port Injection: The Core Pattern](#2-port-injection-the-core-pattern)
3. [The Edge Runtime](#3-the-edge-runtime)
4. [MachinePay: Credit Gating & Offline Operation](#4-machinepay-credit-gating--offline-operation)
5. [Protocol Adapters: Every Protocol, One Runtime](#5-protocol-adapters-every-protocol-one-runtime)
6. [Industrial Action: When Finance Meets Physics](#6-industrial-action-when-finance-meets-physics)
7. [Transport & Infrastructure](#7-transport--infrastructure)
8. [The Full Bridge: Sensor to Settlement](#8-the-full-bridge-sensor-to-settlement)
9. [Real-World Edge Deployments](#9-real-world-edge-deployments)

---

## 1. The Physical-Financial Bridge

There are approximately 15 billion connected devices on Earth. PLCs on factory floors. Temperature sensors in cold-chain shipments. Soil moisture probes in agricultural fields. Robot arms on assembly lines. Smart locks on hotel doors. EV chargers in parking garages. GPU nodes in data centres. Solar inverters on rooftops.

Every single one of these devices produces or consumes value. And exactly zero of them can get paid for what they do.

The reason is not a lack of payment technology. It is a lack of **bridge technology**. No piece of software exists that can take a Modbus register read from a PLC, sign it with a quantum-resistant WOTS key, publish it as a cryptographically verifiable proof, trigger a micro-payment through an eltoo channel, enforce a credit gate, and anchor the whole thing on-chain — all without a cloud server, all without a payment processor, all without the device ever importing a network library.

The Totem Edge Runtime is that bridge. It is not a single package. It is a **composable family of packages** that share one architectural pattern: port injection. You implement the ports you need. You inject them at startup. The runtime does the rest.

---

## 2. Port Injection: The Core Pattern

Every package in the Totem Edge ecosystem follows the same rule: **no package imports a network library.** Not `mqtt.js`. Not `modbus-serial`. Not `socketcan`. Not `noble`. Not `rclnodejs`. Not `node-opcua`. Not `node-bacnet`. Not the Matter SDK.

Instead, every package defines a **transport port interface** — a clean contract that the caller implements for their environment. The package handles the protocol logic. The caller handles the transport.

### 2.1 Why This Matters

**Reach.** The same Modbus adapter works over TCP (a factory PLC on Ethernet), RTU (a sensor on a serial line), or a custom transport (a legacy system with a proprietary protocol). The adapter doesn't care. It just calls `readHoldingRegisters()` on the port you injected.

**Testability.** You can test every adapter with an in-memory mock transport. No hardware required. No network required. The adapter's logic is pure and deterministic.

**Runtime independence.** The same package works in Node.js, Bun, the browser, Pear/Bare, or any runtime that can provide the transport. A soil sensor on LoRaWAN and a GPU node on fibre use the same code. The transport is an implementation detail.

**Security.** No package can accidentally open a network connection. No package can accidentally import a vulnerable native dependency. The attack surface is the port interface — a five-method contract that you control.

### 2.2 The Pattern in Practice

The MQTT adapter (`@totemsdk/edge-mqtt`) is the canonical example. It defines a `MqttClientPort` interface with five methods:

```typescript
interface MqttClientPort {
  connect?(): Promise<void>;
  disconnect?(): Promise<void>;
  subscribe(topic: string): Promise<MqttSubscription>;
  publish(topic: string, payload: Uint8Array | string): Promise<void>;
  onMessage(handler: (message: MqttMessage) => void): () => void;
}
```

That's it. The adapter handles MQTT topic matching, rule routing, sensor bridging, proof publication, command gating, credit enforcement, and offline queuing. It never opens a socket. It never imports `mqtt.js`. It calls the port you injected.

You implement the port for your environment:
- **Node.js:** Wrap `mqtt.js` in the five methods
- **Browser:** Wrap a WebSocket MQTT client
- **Pear/Bare:** Wrap a Hyperswarm stream
- **Test:** Use an in-memory mock

The adapter is identical in all four environments. Only the port implementation changes.

---

## 3. The Edge Runtime

`@totemsdk/edge` is the core runtime. It is the container that holds a device's identity, capabilities, and injected ports. It is the thinnest possible layer — it does almost nothing itself. It provides structure.

### 3.1 Device Identity

Every device has an `EdgeDevice`:

```typescript
const device = createEdgeDevice({
  kind: 'sensor',                    // device | app | agent | sensor | robot | gateway | service
  identityId: 'totem:id:device:...', // links to @totemsdk/identity
  address: 'MxDEVICE7...',           // Minima address
  metadata: { location: 'Building 3, Clean Room B' },
});
```

The device kind is metadata — it doesn't change behaviour. A `sensor` and a `robot` use the same runtime. The difference is in which ports you inject.

### 3.2 Capability Model

Capabilities are string-based declarations of what the device can do:

```typescript
const capabilities = createCapabilitySet([
  'payment:send',
  'proof:create',
  'transport:modbus',
  'chain:lookup-node',
]);
```

The runtime does **not** automatically enforce capabilities. You call `runtime.assertCapability(cap)` before invoking a port method. This gives you fast, explicit failure rather than a cryptic `TypeError` from a missing port reference.

```typescript
runtime.assertCapability('payment:send');  // throws EdgeCapabilityError if missing
await runtime.ports.payment.pay({ recipient, amount });
```

### 3.3 Port Interfaces

The runtime accepts up to 10 port interfaces. You inject only what you need:

| Port | Interface | What It Does |
|------|-----------|-------------|
| `payment` | `EdgePaymentPort` | Send payments via Omnia channels or on-chain |
| `liquidity` | `EdgeLiquidityPort` | Query balances and UTXOs |
| `proof` | `EdgeProofPort` | Create and verify WOTS-signed proofs |
| `lookup` | `EdgeLookupPort` | Discover services, watch addresses, announce manifests |
| `policy` | `EdgePolicyPort` | Check if an action is authorised |
| `identity` | `EdgeIdentityPort` | Resolve and verify identity documents |
| `manifest` | `EdgeManifestPort` | Sign and verify service manifests |
| `keyLease` | `EdgeKeyLeasePort` | Reserve, commit, and burn WOTS key leases |
| `stream` | `EdgeStreamPort` | Bidirectional byte streams |
| `pubsub` | `EdgePubSubPort` | Publish-subscribe messaging |

A temperature sensor only needs `proof` and `pubsub`. A Wi-Fi hotspot needs `payment`, `proof`, `policy`, and `pubsub`. A factory robot needs `payment`, `proof`, `policy`, `identity`, and `manifest`. You inject what you need. The runtime is the same.

### 3.4 Service Manifests

Every device can publish a signed `EdgeServiceManifest` declaring what it is, what it does, and how to pay it:

```typescript
const manifest = {
  type: 'edge-service',
  serviceType: 'machine-service',
  name: 'Solar Inverter 7',
  operatorAddress: 'MxFLEET42...',
  capabilities: ['payment:send', 'proof:create', 'transport:modbus'],
  price: '0.12',                    // MINIMA per kWh
  paymentMethods: ['omnia', 'onchain'],
  endpoints: [{ type: 'mqtt', uri: 'totem/solar-farm/inverter-7' }],
};
```

The manifest is WOTS-signed and cryptographically bound to the device's identity. A counterparty can verify both in one step: "Is this manifest signed by a key authorised by this device's identity document?"

### 3.5 Receipts

Every device action can produce an `EdgeReceipt` — a verifiable record of what happened:

```typescript
const receipt = createEdgeReceipt({
  kind: 'sensor-reading',
  relatedManifestId: manifest.serviceId,
  relatedIdentityId: device.identityId,
  payload: { temperature: 23.5, unit: 'celsius', timestamp: Date.now() },
});
```

Receipts are the audit trail. They link actions to manifests, manifests to identities, and identities to the cryptographic proof graph. An auditor can trace any receipt back to the device that produced it and verify the entire chain.

---

## 4. MachinePay: Credit Gating & Offline Operation

MachinePay is the enforcement layer. It answers the question: "Did the customer pay for this?" If the answer is no, it stops the service.

### 4.1 The Usage Meter

The usage meter tracks consumption by unit type:

```typescript
type MqttUsageUnit = 'message' | 'byte' | 'second' | 'minute' | 'kwh' | 'reading' | 'command' | 'custom';
```

A Wi-Fi hotspot tracks `byte`. A solar inverter tracks `kwh`. A GPU node tracks `second`. A sensor data marketplace tracks `reading`. The meter accumulates usage locally — no network call needed.

### 4.2 The Credit Gate

Three enforcement modes:

| Mode | Behaviour |
|------|-----------|
| **block** | Reject service when unpaid balance exceeds threshold. The Wi-Fi hotspot stops routing packets. |
| **warn** | Allow service but flag the account. The customer gets a notification: "Low balance." |
| **shutdown** | Block service AND publish a shutdown notice. The customer's wallet receives: "Service suspended — unpaid balance: 2.40 MIN." |

The credit gate does **not** call the payment port as a probe. It compares local usage against a threshold. Payment settlement is the caller's responsibility. This keeps the gate fast, deterministic, and offline-capable.

### 4.3 Offline Operation

Devices lose connectivity. MachinePay handles this through an in-memory FIFO queue:

```typescript
const queue = createMemoryMqttEdgeQueue();

// During normal operation:
await queue.enqueue({ topic, payload, timestamp });

// When connectivity returns:
await flushQueuedEvents(client, queue, {
  maxRetries: 3,
  onDeadLetter: (event, reason) => {
    console.error(`Event ${event.id} failed: ${reason}`);
  },
});
```

A vending machine in a basement with no signal can queue 500 transactions. When the delivery driver restocks it and brings a mobile hotspot, the queue drains. No billing events are lost. The device operated autonomously for 3 days without connectivity.

### 4.4 The Wi-Fi Hotspot: End-to-End MachinePay

1. **Discovery:** A traveler's device finds "Cafe Wi-Fi" via the lookup network. Manifest verified. Identity bound. Provider bond score: 88/100. Price: €0.01/MB, Omnia accepted.

2. **Channel open:** The traveler's wallet opens an Omnia channel with 5 MIN deposited.

3. **Service begins:** The traveler connects. The hotspot's usage meter starts counting bytes.

4. **Per-MB billing:** Every 10MB consumed, the hotspot triggers a channel update. The traveler's wallet auto-approves (amount is below the agent policy threshold).

5. **Credit gate triggers:** Balance drops to 0.20 MIN — below the 0.50 MIN warning threshold. The hotspot sends a warning.

6. **Auto-shutdown:** Balance hits 0. The credit gate is in `shutdown` mode. The hotspot stops routing packets. It publishes a shutdown notice.

7. **Top-up:** The traveler splices 10 MIN into the channel. Service resumes.

8. **Session end:** The traveler disconnects. The channel closes cooperatively. A WOTS-signed receipt is generated and anchored on-chain.

The traveler never saw a captive portal. Never entered a credit card. Never created an account. The hotspot never connected to a payment processor. It just enforced the rules.

---

## 5. Protocol Adapters: Every Protocol, One Runtime

The Totem Edge SDK includes 11 protocol adapters. Each one follows the same pattern: define a transport port, implement the protocol logic, expose a gateway and a sensor bridge. Each one is independently installable. Each one is transport-agnostic.

| Adapter | Protocol | Domain | What It Connects |
|---------|----------|--------|-----------------|
| `edge-modbus` | Modbus TCP/RTU | Industrial automation | PLCs, RTUs, sensors, actuators |
| `edge-opcua` | OPC-UA | SCADA, factory floors | Industrial control systems |
| `edge-bacnet` | BACnet | Building automation | HVAC, lighting, access control |
| `edge-can` | CAN bus | Automotive, heavy machinery | Engine controllers, vehicle sensors |
| `edge-ble` | BLE | Wearables, proximity | Beacons, health monitors, smart locks |
| `edge-lorawan` | LoRaWAN | Agriculture, asset tracking | Soil sensors, GPS trackers |
| `edge-matter` | Matter | Smart home | Locks, lights, thermostats |
| `edge-ros2` | ROS 2 | Robotics | Autonomous platforms, robot arms |
| `edge-coap` | CoAP (RFC 7252) | Constrained devices | Low-power sensors, UDP transport |
| `edge-grpc` | gRPC | Cloud-to-edge | Service mesh, control planes |
| `edge-email` | SMTP/IMAP | Notification, command | Email-triggered actions, alerts |

### 5.1 The Common Pattern

Every adapter exposes two main factories:

**Gateway** — handles protocol-level dispatch. Subscribes to protocol-specific data sources, parses messages, routes them to handlers.

**Sensor Bridge** — maps raw protocol data to proof envelopes. A Modbus register read becomes a WOTS-signed proof. A BACnet property value becomes a verifiable reading. A CAN bus DBC signal becomes a cryptographically provable measurement.

### 5.2 Example: Modbus PLC

```typescript
import { createEdgeRuntime, createCapabilitySet } from '@totemsdk/edge';
import { createModbusGateway, createModbusSensorBridge } from '@totemsdk/edge-modbus';
import type { ModbusTransportPort } from '@totemsdk/edge-modbus';

// 1. Implement the transport for your environment
const transport: ModbusTransportPort = {
  readHoldingRegisters: async (unitId, address, count) => { /* your Modbus library */ },
  readCoils: async (unitId, address, count) => { /* ... */ },
  // ...
};

// 2. Create the runtime
const runtime = createEdgeRuntime({
  deviceId: 'factory-plc-01',
  capabilities: createCapabilitySet(['transport:modbus', 'proof:create']),
  ports: { proof: myProofPort, pubsub: myPubSubPort },
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
    {
      sensorId: 'temp-zone-1',
      unitId: 1,
      functionCode: 3,
      address: 0,
      count: 2,
      intervalMs: 5000,
      dataType: 'temperature',
      unit: '°C',
    },
  ],
});
await bridge.start();
```

The PLC never imported a network library. The Modbus adapter never imported a Modbus library. The transport was injected. The proof was generated. The reading is cryptographically provable.

---

## 6. Industrial Action: When Finance Meets Physics

`@totemsdk/industrial-action` bridges the gap between "a financial event occurred" and "a physical action must happen." A payment clears → a vending machine dispenses. A channel settles → a smart lock opens. A governance vote passes → a circuit breaker trips.

### 6.1 The Action Lifecycle

```
propose → validate commitment → check guardrails → execute → verify receipt
```

**Propose:** An action is proposed with parameters and context. The proposal includes a domain-prefixed SHA3-256 commitment hash that prevents parameter tampering.

**Validate commitment:** The executor verifies that the proposal hasn't been altered since it was created.

**Check guardrails:** Pre-execution conditions are evaluated:
- `parameter_range` — is the parameter within allowed bounds?
- `context_match` — does the context match expected values?
- `time_window` — is the action being executed within the allowed time window?
- `custom` — any custom condition the operator defines

**Execute:** The executor plugin runs the action. The result is mapped to `confirmed`, `failed`, or `unknown`.

**Verify receipt:** A verifiable receipt is produced with integrity checks. The receipt links the action to the proposal, the proposal to the mandate, and the mandate to the governance decision that authorised it.

### 6.2 Guardrails

Guardrails are the safety layer. They ensure a device never exceeds its authority:

```typescript
const guardrails = [
  { field: 'temperature', operator: 'lte', value: 100 },     // never exceed 100°C
  { field: 'pressure', operator: 'gte', value: 0 },           // never go below 0 bar
  { field: 'duration', operator: 'lte', value: 3600 },        // max 1 hour runtime
  { field: 'recipient', operator: 'in', value: ['MxMAINT...'] }, // only authorised recipients
];
```

A vending machine won't dispense if the payment hasn't cleared. A robot arm won't move if the safety interlock isn't engaged. A circuit breaker won't trip unless the governance vote passed and the execution delay elapsed.

### 6.3 The Governance Bridge

Industrial actions integrate with the governance stack through a reserve-before-execute pattern:

1. **Reserve:** The governance layer reserves a mandate use slot
2. **Execute:** The action runs
3. **Commit:** On success, the mandate use is committed and a receipt is recorded
4. **Abort:** On failure, the mandate use is aborted and the slot is freed

This ensures that every physical action is authorised by a valid mandate, every mandate use is tracked, and every action produces a verifiable receipt.

---

## 7. Transport & Infrastructure

### 7.1 Stream Transport

`@totemsdk/stream-transport` provides bidirectional byte-stream adapters for every environment:

| Adapter | Use Case |
|---------|----------|
| `NodeStreamTransport` | Any Node.js Duplex/Socket stream |
| `WebSocketTransport` | Browser and Node.js WebSocket |
| `WebRTCDataChannelTransport` | Browser P2P data channels |
| `StdioStreamTransport` | Process stdin/stdout |
| `HyperswarmStreamTransport` | P2P DHT connections |
| `InMemoryTransport` | Unit testing |

### 7.2 PubSub Transport

`@totemsdk/pubsub-transport` provides MQTT-compatible publish-subscribe interfaces:

```typescript
interface IPubSubTransport {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  subscribe(topic: string): Promise<PubSubSubscription>;
  publish(topic: string, payload: string | Uint8Array): Promise<void>;
  onMessage(handler: (message: PubSubMessage) => void): () => void;
}
```

In-memory and mock implementations for testing. Real implementations for production. The interface is the same.

### 7.3 Pear/Bare Runtime

`@totemsdk/pear` adapts the Totem SDK to Holepunch's Pear/Bare P2P application runtime. Devices can run as fully decentralised applications with zero servers:

- **Storage:** Pear-native key-value storage
- **Networking:** Hyperswarm DHT and Hyperdrive distributed filesystem
- **Lifecycle:** App startup, shutdown, and reload hooks
- **Logging:** Structured logging adapter

A Pear/Bare device is a self-contained P2P node. It discovers peers via the DHT. It stores data locally. It participates in the Omnia payment network. It never connects to a server because there is no server.

### 7.4 Node.js Server

`@totemsdk/server` provides server-side wallet operations for Node.js. It handles the full transaction lifecycle: fetch coins → build → sign → mine TxPoW → broadcast. It includes a WebSocket/HTTP client to a running Minima node and a `ChainStateProvider` implementation.

---

## 8. The Full Bridge: Sensor to Settlement

Here is the complete path from a physical sensor reading to an on-chain settlement, using only Totem Edge packages:

```
┌─────────────────────────────────────────────────────────────┐
│ 1. PHYSICAL LAYER                                           │
│    A Modbus temperature sensor reads 23.5°C                 │
│    edge-modbus polls the PLC every 5 seconds                │
├─────────────────────────────────────────────────────────────┤
│ 2. RUNTIME LAYER                                            │
│    @totemsdk/edge provides device identity + capabilities   │
│    Ports injected: proof, pubsub, payment, policy           │
├─────────────────────────────────────────────────────────────┤
│ 3. PROOF LAYER                                              │
│    edge-adapters wires proof port to @totemsdk/proof        │
│    Sensor reading becomes a WOTS-signed proof envelope      │
├─────────────────────────────────────────────────────────────┤
│ 4. MACHINEPAY LAYER                                         │
│    edge-mqtt usage meter tracks the reading                 │
│    Credit gate checks: is the data buyer's balance > 0?     │
│    If yes: publish proof. If no: block and warn.            │
├─────────────────────────────────────────────────────────────┤
│ 5. PAYMENT LAYER                                            │
│    edge-adapters wires payment port to @totemsdk/omnia      │
│    Channel update: Buyer pays 0.001 MIN for the reading    │
│    Eltoo state update, off-chain, instant                   │
├─────────────────────────────────────────────────────────────┤
│ 6. ANCHORING LAYER                                          │
│    @totemsdk/proof-integritas anchors proof hash on-chain   │
│    Permanent, publicly verifiable record                    │
├─────────────────────────────────────────────────────────────┤
│ 7. GOVERNANCE LAYER                                         │
│    @totemsdk/authority verifies: is this sensor authorised? │
│    @totemsdk/agent-policy enforces: max price, allowed buyer│
├─────────────────────────────────────────────────────────────┤
│ 8. SETTLEMENT LAYER                                         │
│    Channel factory settles monthly                          │
│    One on-chain transaction for 10,000 sensors               │
└─────────────────────────────────────────────────────────────┘
```

Every step is cryptographically provable. Every step is transport-agnostic. Every step is quantum-resistant. No centralised server required.

---

## 9. Real-World Edge Deployments

### 9.1 The Soil Sensor

A soil moisture sensor in a Kenyan field. LoRaWAN connectivity only. No IP stack. No TLS. No WebSocket.

**The stack:**
- `edge-lorawan` — protocol adapter, transport port bridged to LoRaWAN gateway
- `@totemsdk/edge` — runtime with `proof` and `pubsub` ports
- `@totemsdk/proof` — WOTS-signed proof envelopes for every reading
- Self-hosted DHT relay at the farm gateway — bridges LoRaWAN to the Omnia network

The sensor takes a reading every 15 minutes. It signs it with WOTS. It publishes it as a proof. A data buyer in London discovers it via the lookup network. Payment flows through an Omnia channel. The sensor never touched the internet.

### 9.2 The Factory Robot

A robot arm on an automotive assembly line. OPC-UA connectivity to the factory SCADA system. Safety-critical operations. Regulatory compliance required.

**The stack:**
- `edge-opcua` — protocol adapter, transport port bridged to OPC-UA server
- `@totemsdk/edge` — runtime with `payment`, `proof`, `policy`, `identity`, `manifest` ports
- `@totemsdk/industrial-action` — guardrails: max torque, max speed, authorised operators only
- `@totemsdk/recursive-mast` — 7-layer policy stack: manufacturer → regulatory → owner → site → operator
- `@totemsdk/authority` — mandate verification before every operation

The robot arm executes a welding operation. The industrial action verifies the mandate. The guardrails check torque and speed limits. The proof layer records the operation. The payment layer settles the per-operation fee. The auditor verifies the entire chain.

### 9.3 The Vending Machine

A vending machine in a basement. No internet connectivity. BLE for customer interaction. Offline operation required.

**The stack:**
- `edge-ble` — protocol adapter, transport port bridged to BLE peripheral
- `@totemsdk/edge` — runtime with `payment` and `proof` ports
- `@totemsdk/omnia-vtxo` — VTXO pool for offline payments
- `@totemsdk/edge-mqtt` — offline queue for delayed settlement

Customer approaches. Wallet discovers machine via BLE. Customer selects a €2 snack. Wallet presents a €5 VTXO. Machine verifies the Merkle proof, splits it: €2 to machine, €3 change. Machine dispenses. Total time: <1 second. No network connectivity required. At end of day, the delivery driver's phone provides connectivity. The queue drains. The day's VTXOs are merged and exited on-chain.

### 9.4 The Smart Lock

A hotel door lock. Thread/Matter connectivity. Statechain-based access credentials. Offline verification required.

**The stack:**
- `edge-matter` — protocol adapter, transport port bridged to Thread border router
- `@totemsdk/edge` — runtime with `proof` and `policy` ports
- `@totemsdk/statechain` — statechain verification for room access
- `@totemsdk/authority` — mandate: "Guest X, Room 302, check-in 14:00, check-out 11:00"

Guest presents statechain to lock. Lock verifies chain of custody off-chain. Lock checks: is this statechain valid? Is the guest within their stay window? Is the lock's policy satisfied? All checks pass. Lock opens. No network call. No front desk. No plastic key card.

---

## Appendix: Package Reference

### `@totemsdk/edge` — Core Runtime

| Export | Purpose |
|--------|---------|
| `createEdgeRuntime(opts)` | Create runtime with device ID, capabilities, and injected ports |
| `createEdgeDevice(opts)` | Create device identity record |
| `createCapabilitySet(caps)` | Declare device capabilities |
| `assertCapability(set, cap)` | Assert a capability, throw on missing |
| `createEdgeReceipt(opts)` | Create verifiable action receipt |
| `createEdgeServiceManifest(manifest, seed, keyIndex)` | Sign a service manifest |
| `bindEdgeServiceIdentity(manifest, graph)` | Cryptographically bind manifest to identity |

### `@totemsdk/edge-mqtt` — MQTT Adapter + MachinePay

| Export | Purpose |
|--------|---------|
| `createMqttEdgeGateway(config)` | Create MQTT gateway with rule routing |
| `createMqttSensorBridge(config)` | Map MQTT sensor readings to proof envelopes |
| `createMqttProofPublisher(config)` | Publish proof envelopes |
| `createMqttCommandHandler(config)` | Parse and gate command messages |
| `createMqttUsageMeter(config)` | Track usage by unit type |
| `createMqttCreditGate(config)` | Enforce credit limits (block/warn/shutdown) |
| `createMemoryMqttEdgeQueue()` | In-memory FIFO queue for offline buffering |
| `flushQueuedEvents(client, queue)` | Drain offline queue with retry |

### `@totemsdk/edge-adapters` — Port Adapters

| Export | Bridges To |
|--------|-----------|
| `createLiquidityPortAdapter` | `@totemsdk/chain-provider` |
| `createProofPortAdapter` | `@totemsdk/proof` |
| `createLookupPortAdapter` | `@totemsdk/lookup-client` |
| `createPolicyPortAdapter` | `@totemsdk/agent-policy` |
| `createIdentityPortAdapter` | `@totemsdk/identity` |
| `createManifestPortAdapter` | `@totemsdk/manifest` |
| `createMinimaL1PaymentPort` | `@totemsdk/root-identity` (on-chain) |
| `createOmniaL2PaymentPort` | `@totemsdk/omnia-router` (off-chain) |

### `@totemsdk/industrial-action` — Physical Actuation

| Export | Purpose |
|--------|---------|
| `createProposal(params)` | Create action proposal with commitment hash |
| `verifyCommitment(proposal)` | Verify proposal integrity |
| `evaluateConditions(conditions, context)` | Evaluate guardrails before execution |
| `executeAction(executor, proposal)` | Run executor, map result |
| `createReceipt(execution)` | Create verifiable action receipt |
| `createGovernanceBridge(config)` | Reserve/commit/abort for governance integration |

---

*The Totem Edge Runtime Grey Paper. Port-injected, transport-agnostic, offline-capable — the bridge between physical devices and cryptographic finance.*
