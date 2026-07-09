# @totemsdk/edge

Unified developer-facing runtime for Totem Edge.

## Install

```bash
npm install @totemsdk/edge
```

> `@totemsdk/connect` is a **peer dependency** used only for the `edgeCapabilitiesFromTotemCapabilities` type bridge. It is imported with `import type` exclusively — no runtime import is emitted, so `@totemsdk/edge` is independently deployable without `@totemsdk/connect` installed.

## Design

`@totemsdk/edge` composes identity, manifest, wallet/payment/proof/lookup/policy capabilities via injected port interfaces. It is adapter-neutral — no ROS2, no MQTT, no Python bindings, no direct proof implementation.

### Port injection pattern

All capability ports (`EdgePaymentPort`, `EdgeLiquidityPort`, `EdgeProofPort`, `EdgeLookupPort`, `EdgePolicyPort`, `EdgeIdentityPort`, `EdgeManifestPort`) are interfaces only. You implement the ports you need and inject them via `EdgeRuntimePorts` at startup. `@totemsdk/edge` ships no proof creation or verification implementations.

### Capability set

You declare capabilities up front in the `EdgeCapabilitySet`. The runtime does **not** automatically enforce capabilities before port calls — call `runtime.assertCapability(cap)` manually before invoking a port method. This gives fast, explicit failure rather than a cryptic `TypeError` from a missing port reference.

## Usage examples

### Wire up a runtime with mocked ports

```typescript
import {
  createEdgeRuntime,
  createEdgeDevice,
  createCapabilitySet,
} from '@totemsdk/edge';
import type { EdgeRuntimePorts, EdgePaymentPort } from '@totemsdk/edge';

const paymentPort: EdgePaymentPort = {
  async pay({ recipient, amount }) {
    return { ok: true, data: { txpowId: 'mock-txpow-id' } };
  },
};

const ports: EdgeRuntimePorts = { payment: paymentPort };
const capabilities = createCapabilitySet(['payment:send', 'chain:hosted-provider']);

const device = createEdgeDevice({ kind: 'service' });
const runtime = createEdgeRuntime({ deviceId: device.deviceId, capabilities, ports });

runtime.assertCapability('payment:send'); // no-op — present
const result = await runtime.ports.payment!.pay({ recipient: 'MxABC...', amount: '10' });
```

### Create and publish a service manifest

`createEdgeServiceManifest` is a thin wrapper around `signManifest` from `@totemsdk/manifest`. Build the `EdgeServiceManifest` object yourself, then pass it with your WOTS seed and key index.

```typescript
import { createEdgeServiceManifest, bindEdgeServiceIdentity } from '@totemsdk/edge';
import { computeManifestId } from '@totemsdk/manifest';
import type { EdgeServiceManifest } from '@totemsdk/manifest';
import { createIdentityDocument } from '@totemsdk/identity';
import type { IdentityGraph } from '@totemsdk/identity';

// 1. Build the EdgeServiceManifest object
const rawManifest: EdgeServiceManifest = {
  type: 'edge-service',
  serviceId: '',  // filled below
  name: 'temperature-monitor-v1',
  version: '1.0.0',
  operatorAddress: 'MxABC123...',
  serviceType: 'sensor',
  description: 'Real-time temperature telemetry over MQTT',
  endpoints: [{ type: 'mqtt', uri: 'mqtt://edge.example.com:1883/temp' }],
  capabilities: ['temperature:read', 'temperature:stream'],
  tags: ['iot', 'sensor'],
};
rawManifest.serviceId = computeManifestId(rawManifest);

// 2. Sign — seed = 32-byte WOTS seed, keyIndex = reserved via @totemsdk/wots-lease
const signed = await createEdgeServiceManifest(rawManifest, seed, keyIndex);

// 3. Bind to an identity graph (optional but recommended)
const identityDoc = createIdentityDocument({
  kind: 'service',
  rootAddress: 'MxABC123...',
  controllerAddress: 'MxABC123...',
});
const graph: IdentityGraph = { document: identityDoc, claims: [] };
const binding = await bindEdgeServiceIdentity(signed, graph);
// binding.valid — true when manifest signer matches the identity's authorized set
```

### Create and verify receipts

```typescript
import { createEdgeReceipt, verifyEdgeReceipt } from '@totemsdk/edge';

const receipt = createEdgeReceipt({
  kind: 'payment',
  relatedManifestId: signed.manifest.serviceId,
  payload: { recipient: 'MxDEF456...', amount: '10', txpowId: 'abc123...' },
});

// verifyEdgeReceipt returns EdgeOperationResult<{ receipt: EdgeReceipt }> — never a bare boolean
const result = verifyEdgeReceipt(receipt);
if (result.ok) {
  console.log('Valid receipt:', result.data!.receipt.receiptId);
} else {
  console.error('Invalid receipt:', result.error);
}
```

## API reference

### `createEdgeRuntime(opts)`

```typescript
function createEdgeRuntime(opts: {
  deviceId: string;
  capabilities: EdgeCapabilitySet;
  ports: EdgeRuntimePorts;
}): EdgeRuntime;

interface EdgeRuntime {
  version: number;
  deviceId: string;
  capabilities: EdgeCapabilitySet;
  ports: EdgeRuntimePorts;
  hasCapability(cap: EdgeCapability): boolean;
  assertCapability(cap: EdgeCapability): void;  // throws EdgeCapabilityError
}
```

### `createEdgeDevice(opts)`

```typescript
function createEdgeDevice(opts: {
  kind: EdgeDeviceKind;
  identityId?: string;
  address?: string;
  metadata?: Record<string, unknown>;
}): EdgeDevice;

type EdgeDeviceKind = 'device' | 'app' | 'agent' | 'sensor' | 'robot' | 'gateway' | 'service';

interface EdgeDevice {
  deviceId: string;        // edge:device:<hash> URI
  kind: EdgeDeviceKind;
  identityId?: string;
  address?: string;
  metadata?: Record<string, unknown>;
  createdAt: number;       // Unix ms
}
```

### `createEdgeReceipt(opts)` / `verifyEdgeReceipt(receipt)`

```typescript
function createEdgeReceipt(opts: {
  kind: string;
  relatedManifestId?: string;
  relatedIdentityId?: string;
  payload: Record<string, unknown>;
  issuedAt?: number;             // defaults to Date.now()
}): EdgeReceipt;

// Returns EdgeOperationResult<{ receipt: EdgeReceipt }> — never a bare boolean
function verifyEdgeReceipt(receipt: unknown): EdgeOperationResult<{ receipt: EdgeReceipt }>;

interface EdgeReceipt {
  receiptId: string;
  kind: string;
  issuedAt: number;
  relatedManifestId?: string;
  relatedIdentityId?: string;
  payload: Record<string, unknown>;
}
```

### `createEdgeServiceManifest(manifest, seed, keyIndex)`

Thin wrapper around `signManifest` from `@totemsdk/manifest`. Takes a fully-constructed `EdgeServiceManifest` and returns a `SignedManifest`.

```typescript
function createEdgeServiceManifest(
  manifest: EdgeServiceManifest,
  seed: Uint8Array,
  keyIndex: number,
): Promise<SignedManifest<EdgeServiceManifest>>;
```

### `bindEdgeServiceIdentity(signedManifest, identityGraph)`

Verifies a signed `EdgeServiceManifest` against an `IdentityGraph`. Checks that the WOTS signature is valid and the signer address is authorized by the identity.

```typescript
function bindEdgeServiceIdentity(
  signedManifest: SignedManifest<EdgeServiceManifest>,
  identityGraph: IdentityGraph,
  options?: { proofVerifiers?: Record<string, IdentityProofVerifier> },
): Promise<ManifestIdentityBinding>;
```

### `createCapabilitySet` / `hasCapability` / `assertCapability`

```typescript
function createCapabilitySet(caps: EdgeCapability[]): EdgeCapabilitySet;
function hasCapability(set: EdgeCapabilitySet, cap: EdgeCapability): boolean;
function assertCapability(set: EdgeCapabilitySet, cap: EdgeCapability): void;
```

### `edgeCapabilitiesFromTotemCapabilities(caps)`

Maps a `TotemCapabilities` object from `@totemsdk/connect` to an `EdgeCapabilitySet`. Requires `@totemsdk/connect` to be installed as a peer.

```typescript
function edgeCapabilitiesFromTotemCapabilities(caps: TotemCapabilities): EdgeCapabilitySet;
```

## Port interfaces

```typescript
interface EdgePaymentPort {
  pay(params: { recipient: string; amount: string; tokenId?: string; memo?: string }): Promise<EdgeOperationResult<{ txpowId?: string }>>;
}

interface EdgeLiquidityPort {
  getBalance(address: string): Promise<EdgeOperationResult<{ balance: string; tokenId: string }>>;
  getUtxos(address: string):   Promise<EdgeOperationResult<{ utxos: unknown[] }>>;
}

interface EdgeProofPort {
  createProof(params: { subject: string; claims: unknown[]; context?: Record<string, unknown> }): Promise<EdgeOperationResult<{ proofId: string; proof: unknown }>>;
  verifyProof(params: { proof: unknown; subject?: string }): Promise<EdgeOperationResult<{ valid: boolean; reason?: string }>>;
}

interface EdgeLookupPort {
  lookup(params: { query: string; kind?: string }): Promise<EdgeOperationResult<{ results: unknown[] }>>;
  watch(params: { address: string; onUpdate: (data: unknown) => void }): Promise<EdgeOperationResult<{ unsubscribe: () => void }>>;
}

interface EdgePolicyPort {
  check(params: { action: string; subject: string; context?: Record<string, unknown> }): Promise<EdgeOperationResult<{ allowed: boolean; reason?: string }>>;
}

interface EdgeIdentityPort {
  resolve(identityId: string): Promise<EdgeOperationResult<{ identity: unknown }>>;
  verify(proof: unknown): Promise<EdgeOperationResult<{ valid: boolean; address?: string }>>;
}

interface EdgeManifestPort {
  sign(manifest: unknown, seed: Uint8Array, keyIndex: number): Promise<EdgeOperationResult<{ signed: unknown }>>;
  verify(signed: unknown): Promise<EdgeOperationResult<{ valid: boolean; reason?: string }>>;
}
```

`EdgeOperationResult<T>` is `{ ok: boolean; data?: T; error?: string; errorCode?: string }`.

## Related packages

- [`@totemsdk/manifest`](https://www.npmjs.com/package/@totemsdk/manifest) — manifest schemas and signing
- [`@totemsdk/identity`](https://www.npmjs.com/package/@totemsdk/identity) — identity documents and claims
- [`@totemsdk/core`](https://www.npmjs.com/package/@totemsdk/core) — WOTS signing primitives
- [`@totemsdk/wots-lease`](https://www.npmjs.com/package/@totemsdk/wots-lease) — WOTS key index reservation

## License

MIT
