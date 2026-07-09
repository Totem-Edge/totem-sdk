# @totemsdk/edge-mqtt

Transport-agnostic MQTT adapter for Totem Edge — sensors, gateways, robots, cold-chain trackers, and MachinePay devices.

This package ships **zero runtime network dependencies**. It does not import `mqtt.js`, `net`, `tls`, `ws`, `http`, or `fs`. All network behaviour is injected via a `MqttClientPort` interface, making it fully compatible with Bare, Pear, Node.js, Bun, and any environment that can provide a publish/subscribe abstraction.

## Install

```bash
npm install @totemsdk/edge-mqtt
```

Peer dependency:

```bash
npm install @noble/hashes
```

## Design

`@totemsdk/edge-mqtt` wraps an `EdgeRuntime` (from `@totemsdk/edge`) with an MQTT-aware dispatch layer. You supply the transport client; the package handles rule routing, sensor bridging, proof publication, command gating, MachinePay credit enforcement, offline queuing, and service manifests.

### Transport injection

You implement `MqttClientPort` — a five-method interface — for your environment:

```typescript
interface MqttClientPort {
  connect?(): Promise<void>;
  disconnect?(): Promise<void>;
  subscribe(topic: string, options?: MqttSubscribeOptions): Promise<MqttSubscription>;
  publish(topic: string, payload: Uint8Array | string, options?: MqttPublishOptions): Promise<void>;
  onMessage(handler: (message: MqttMessage) => void | Promise<void>): () => void;
}
```

`connect` and `disconnect` are optional — useful when the client manages its own lifecycle.

### Transport kinds

`MqttTransportKind` is stored as metadata only — never used to open a connection:

```typescript
type MqttTransportKind =
  | 'broker'        // standard TCP/TLS MQTT broker
  | 'websocket'     // MQTT-over-WebSocket
  | 'embedded'      // in-process broker (e.g. Aedes)
  | 'hyperswarm'    // Hyperswarm topic used as MQTT channel
  | 'pear'          // Pear/Bare RPC channel
  | 'mock'          // test double
  | 'custom';
```

### Gateway dispatch

The gateway dispatches **only** to the handlers you inject. If no handler is supplied for a given rule kind, matching messages are silently dropped — no subsystems are instantiated implicitly:

```typescript
const gw = createMqttEdgeGateway({
  deviceId: 'cold-chain-1',
  client,
  runtime,
  rules: [...],
  commandHandler,   // optional — only loaded if you provide it
  proofPublisher,   // optional
  sensorBridge,     // optional
});
```

---

## Quick start

### 1. Build a mock client (or bring your own)

```typescript
import type { MqttClientPort, MqttMessage } from '@totemsdk/edge-mqtt';

const handlers: Array<(m: MqttMessage) => void> = [];

const client: MqttClientPort = {
  async connect() { /* open TCP connection */ },
  async disconnect() { /* close cleanly */ },
  async subscribe(topic) {
    return { topic, async unsubscribe() {} };
  },
  async publish(topic, payload) {
    /* forward to broker */ console.log('→', topic);
  },
  onMessage(handler) {
    handlers.push(handler);
    return () => handlers.splice(handlers.indexOf(handler), 1);
  },
};
```

### 2. Create a runtime and gateway

```typescript
import {
  createEdgeRuntime,
  createCapabilitySet,
} from '@totemsdk/edge';
import {
  createMqttEdgeGateway,
  createMqttRuleEngine,
} from '@totemsdk/edge-mqtt';

const runtime = createEdgeRuntime({
  deviceId: 'cold-chain-1',
  capabilities: createCapabilitySet(['sensor:read', 'proof:create']),
  ports: {},
});

const gw = createMqttEdgeGateway({
  deviceId: 'cold-chain-1',
  client,
  runtime,
  transport: { kind: 'broker', brokerUri: 'mqtt://broker.example.com:1883' },
  rules: [
    { id: 'sensor-rule', kind: 'proof', topicPattern: 'sensors/+/+/raw', enabled: true },
    { id: 'cmd-rule',    kind: 'command', topicPattern: 'totem/+/commands', enabled: true },
  ],
});

await gw.start();
// → subscribes to rule topics, publishes status, ready for messages
```

### 3. Bridge sensor readings to proof envelopes

```typescript
import { createMqttProofPublisher, createMqttSensorBridge } from '@totemsdk/edge-mqtt';

const proofPublisher = createMqttProofPublisher({
  runtime,
  client,
  defaultProofTopic: 'sensors/cold-chain-1/proofs',
  defaultReceiptTopic: 'sensors/cold-chain-1/receipts',
});

const sensorBridge = createMqttSensorBridge({
  gateway: gw,
  client,
  proofPublisher,
  bindings: [
    {
      sensorId: 'temp-01',
      inputTopic: 'sensors/cold-chain-1/temp-01/raw',
      proofTopic: 'sensors/cold-chain-1/temp-01/proof',
      receiptTopic: 'sensors/cold-chain-1/temp-01/receipt',
      dataType: 'temperature',
    },
  ],
});

await sensorBridge.start();
```

### 4. Gate outgoing messages behind MachinePay credit

```typescript
import { createMqttCreditGate } from '@totemsdk/edge-mqtt';

const gate = createMqttCreditGate({
  runtime,
  deviceId: 'cold-chain-1',
  client,
  unpaidLimit: '1000',   // block after 1000 accumulated units
  mode: 'block',          // 'block' | 'warn' | 'shutdown'
  shutdownTopic: 'totem/cold-chain-1/shutdown',
});

// Record usage from your usage meter or directly:
gate.recordUsage('1');   // called per reading, byte, message, etc.

// Publish only if within limit:
const result = await gate.gatePublish('sensors/cold-chain-1/temp-01/raw', payload);
if (!result.ok) {
  console.warn('Blocked — credit exceeded:', result.errorCode);
}
```

Link to an external `MqttUsageMeter` via `getUsage`:

```typescript
const meter = createMqttUsageMeter({ runtime, deviceId: 'cold-chain-1' });
await meter.recordUsage({ eventId: 'ev-1', deviceId: 'cold-chain-1', unit: 'reading', quantity: '1', createdAt: Date.now() });

const gate = createMqttCreditGate({
  runtime,
  deviceId: 'cold-chain-1',
  client,
  unpaidLimit: '1000',
  mode: 'block',
  getUsage: () => meter.getUnpaidUsage(), // live link
});
```

---

## All exports

### Gateway

| Export | Description |
|--------|-------------|
| `createMqttEdgeGateway(config)` | Create a gateway that subscribes, dispatches, and publishes status/manifest |

### Sensor bridge

| Export | Description |
|--------|-------------|
| `createMqttSensorBridge(config)` | Map raw MQTT sensor readings to proof envelopes |

### Proof publisher

| Export | Description |
|--------|-------------|
| `createMqttProofPublisher(config)` | Create/publish proof envelopes; supports `edge-port` and `proof-package` modes |

**Proof modes:**

- `edge-port` (default) — delegates `createProof` to `runtime.ports.proof` when present; falls back to an unsigned envelope
- `proof-package` — calls `createProof()` directly from `@totemsdk/proof` using the injected subject/issuer; does not manage WOTS lease

### Command handler

| Export | Description |
|--------|-------------|
| `createMqttCommandHandler(config)` | Parse command messages, gate via `runtime.ports.policy.check()`, execute via injected `MqttCommandExecutor` |

### MachinePay / usage

| Export | Description |
|--------|-------------|
| `createMqttUsageMeter(config)` | Accumulate usage events (message / byte / second / minute / kwh / reading / command / custom); issue receipts |
| `createMqttCreditGate(config)` | Gate publishes behind a local unpaid threshold; supports block / warn / shutdown modes |

### Queue

| Export | Description |
|--------|-------------|
| `createMemoryMqttEdgeQueue()` | In-memory FIFO queue for offline buffering |
| `flushQueuedEvents(client, queue, opts?)` | Drain queue; dead-letters failed events via `onDeadLetter` callback |
| `createDeadLetterEvent(event, reason)` | Attach `deadLetter: true` metadata to a failed event |

### Manifest & lookup

| Export | Description |
|--------|-------------|
| `createMqttEdgeServiceManifest(input)` | Build an unsigned `EdgeServiceManifest` (caller signs with seed + keyIndex) |
| `publishMqttManifest(client, manifest, topic)` | Publish a manifest object as JSON to an MQTT topic |
| `announceMqttService(runtime, manifest)` | Call `runtime.ports.lookup.announce()` if available; returns structured failure if not |

### Realtime mirror

| Export | Description |
|--------|-------------|
| `mirrorMqttToRealtime(message, port)` | Forward an MQTT message to a `RealtimePort`; Uint8Array payloads are base64-wrapped as `{ __type: 'bytes', data: '...' }` |

### Receipts

| Export | Description |
|--------|-------------|
| `createMqttReceipt(input)` | Build an `EdgeReceipt` with `mqtt:<kind>` prefix |
| `publishMqttReceipt(client, receipt, topic)` | Publish a receipt as JSON to an MQTT topic |

### Topics

| Export | Description |
|--------|-------------|
| `createDefaultMqttTopics(deviceId)` | Build the 7 standard Totem MQTT topics for a device |
| `createSensorTopic(deviceId, sensorId, type)` | Build a `sensors/<deviceId>/<sensorId>/<type>` topic |
| `matchMqttTopic(pattern, topic)` | Match an MQTT topic against a pattern with `+` and `#` wildcards |

**Default topics** (all under `totem/<deviceId>/`):

| Topic | Purpose |
|-------|---------|
| `totem/<id>/status` | Gateway running/stopped status |
| `totem/<id>/manifest` | Service manifest |
| `totem/<id>/proofs` | Proof envelopes |
| `totem/<id>/receipts` | Payment and proof receipts |
| `totem/<id>/payments` | Incoming payment messages |
| `totem/<id>/commands` | Incoming command messages |
| `totem/<id>/errors` | Error reports |

### Rule engine

| Export | Description |
|--------|-------------|
| `createMqttRuleEngine(rules)` | Build an engine from an array of `MqttTopicRule`; disabled rules are excluded |
| `findMatchingRules(engine, topic)` | Return all rules whose pattern matches a topic string |
| `routeMqttMessage(engine, message)` | Return `MqttRouteDecision[]` for a message |

### Canonical codec

| Export | Description |
|--------|-------------|
| `encodeMqttEdgeMessage(message)` | Canonical JSON → `Uint8Array`; Uint8Array payloads base64-wrapped |
| `decodeMqttEdgeMessage(bytes)` | Decode back to `MqttMessage`; throws on missing `topic` or invalid JSON |
| `computeMqttEventId(event)` | `mqtt:event:<sha3-256-hex>` deterministic event identifier |
| `canonicalJson(value)` | Sorted-key, no-undefined JSON serialisation |
| `toHex(bytes)` | `Uint8Array` → lowercase hex (no `0x` prefix) |

### Errors

| Export | Description |
|--------|-------------|
| `MqttEdgeError` | Base error class |
| `MqttClientUnavailableError` | Client port is not connected or unavailable |
| `MqttPolicyRejectedError` | `runtime.ports.policy.check()` returned `allowed: false` |
| `MqttPaymentRequiredError` | Payment port required but not configured |
| `MqttCreditExceededError` | Unpaid usage exceeds the configured limit |
| `MqttProofCreationError` | Proof publisher failed to create a proof envelope |
| `MqttQueueError` | Queue operation failed |

---

## Type reference

### `MqttTransportInfo`

```typescript
interface MqttTransportInfo {
  kind: MqttTransportKind;
  brokerUri?: string;       // for 'broker' kind
  swarmTopic?: string;      // for 'hyperswarm' kind
  metadata?: Record<string, unknown>;
}
```

### `MqttTopicRule`

```typescript
interface MqttTopicRule {
  id: string;
  kind: 'proof' | 'payment' | 'command' | 'custom';
  topicPattern: string;     // supports + and # wildcards
  enabled: boolean;
  metadata?: Record<string, unknown>;
}
```

### `MqttEdgeGatewayConfig`

```typescript
interface MqttEdgeGatewayConfig {
  deviceId: string;
  client: MqttClientPort;
  runtime: EdgeRuntime;
  identity?: TotemIdentityDocument;
  manifest?: SignedManifest<EdgeServiceManifest>;
  rules?: MqttTopicRule[];
  topics?: Partial<MqttTopicSet>;
  queue?: MqttEdgeQueue;
  transport?: MqttTransportInfo;
  metadata?: Record<string, unknown>;
  commandHandler?: MqttCommandHandler;
  proofPublisher?: MqttProofPublisher;
  sensorBridge?: MqttSensorBridge;
}
```

### `MqttSensorBinding`

```typescript
interface MqttSensorBinding {
  sensorId: string;
  inputTopic: string;
  proofTopic?: string;
  receiptTopic?: string;
  dataType?: string;
  subjectType?: string;
}
```

### `MqttProofEnvelope`

```typescript
interface MqttProofEnvelope {
  envelopeId: string;      // mqtt:event:<sha3-256-hex>
  topic: string;
  message: MqttMessage;
  proof?: unknown;         // UnsignedProof or SignedProof
  proofId?: string;
  createdAt: number;
  metadata?: Record<string, unknown>;
}
```

### `MqttUsageUnit`

```typescript
type MqttUsageUnit =
  | 'message' | 'byte' | 'second' | 'minute'
  | 'kwh' | 'reading' | 'command' | 'custom';
```

### `MqttCreditGate`

```typescript
interface MqttCreditGate {
  recordUsage(quantity: string): void;
  getUnpaidUsage(): string;
  checkCredit(): Promise<MqttCreditDecision>;
  gatePublish(topic: string, payload: Uint8Array | string, options?: MqttPublishOptions): Promise<EdgeOperationResult>;
  publishShutdownNotice(reason: string): Promise<void>;
}
```

---

## MachinePay credit gate — detailed behaviour

The credit gate enforces a **local threshold comparison** only. It does not call `runtime.ports.payment.pay()` as a probe — payment settlement is the responsibility of the caller.

| Mode | Behaviour when limit exceeded |
|------|-------------------------------|
| `'block'` | `gatePublish` returns `MQTT_CREDIT_EXCEEDED`; no publish |
| `'warn'` | Publish proceeds; `MqttCreditDecision.allowed` is `false` |
| `'shutdown'` | Blocks publish AND publishes a JSON notice to `shutdownTopic` |

Usage accumulates either via direct `gate.recordUsage(quantity)` calls, or by supplying a `getUsage: () => string` hook that reads from a shared `MqttUsageMeter`.

---

## Offline queue — flush and dead-letter

```typescript
import {
  createMemoryMqttEdgeQueue,
  flushQueuedEvents,
  createDeadLetterEvent,
} from '@totemsdk/edge-mqtt';

const queue = createMemoryMqttEdgeQueue();

// Buffer messages while offline
await queue.enqueue({
  id: 'ev-1', type: 'proof', topic: 'sensors/dev/proof',
  payload: JSON.stringify(envelope), createdAt: Date.now(), attempts: 0,
});

// Reconnected — flush
const result = await flushQueuedEvents(client, queue, {
  maxRetries: 3,
  onDeadLetter: (event) => {
    console.error('Dead-lettered:', event.id, event.metadata?.deadLetterReason);
  },
});
```

---

## Canonical codec

`encodeMqttEdgeMessage` and `decodeMqttEdgeMessage` use canonical JSON (sorted keys, no `undefined`) for deterministic byte-exact encoding, enabling transport over Pear, Axia relay, or any channel that carries raw bytes:

```typescript
import { encodeMqttEdgeMessage, decodeMqttEdgeMessage } from '@totemsdk/edge-mqtt';

const bytes = encodeMqttEdgeMessage({
  topic: 'sensors/dev/temp/raw',
  payload: new Uint8Array([0x01, 0x02]),
  receivedAt: Date.now(),
});

// ... carry bytes over any transport ...

const message = decodeMqttEdgeMessage(bytes);
// message.payload is Uint8Array restored from base64 envelope
```

---

## Pear / Bare compatibility

This package imposes no constraints on how you implement `MqttClientPort`. A Pear application can use a Hyperswarm topic as its transport:

```typescript
import type { MqttClientPort } from '@totemsdk/edge-mqtt';

// Hyperswarm-backed implementation — written entirely by you
const client: MqttClientPort = {
  async connect() { await swarm.join(topicBuffer); },
  async disconnect() { await swarm.leave(topicBuffer); },
  async subscribe(topic) { /* track topic filter */ return { topic, async unsubscribe() {} }; },
  async publish(topic, payload) { peer.write(encodeMqttEdgeMessage({ topic, payload, receivedAt: Date.now() })); },
  onMessage(handler) {
    swarm.on('data', (buf) => handler(decodeMqttEdgeMessage(buf)));
    return () => swarm.off('data', handler);
  },
};
```

---

## Related packages

| Package | Description |
|---------|-------------|
| [`@totemsdk/edge`](https://www.npmjs.com/package/@totemsdk/edge) | Unified Edge runtime — inject ports, assert capabilities |
| [`@totemsdk/proof`](https://www.npmjs.com/package/@totemsdk/proof) | WOTS-signed proof envelope lifecycle |
| [`@totemsdk/proof-integritas`](https://www.npmjs.com/package/@totemsdk/proof-integritas) | On-chain anchoring for proof commitments |
| [`@totemsdk/manifest`](https://www.npmjs.com/package/@totemsdk/manifest) | Sign and verify service manifests |
| [`@totemsdk/identity`](https://www.npmjs.com/package/@totemsdk/identity) | Root identity graph — link addresses to a single identity |

---

## License

MIT — see [LICENSE](./LICENSE).
