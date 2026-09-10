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

### Governed agent facade

`createAgentEdgeRuntime` is the **only** entry point an agent should ever hold. It exposes a single `executeAction` method and **never** the raw ports. Every action flows through the universal action registry:

```text
resolve action
→ check runtime capability
→ prepare/simulate
→ derive actual effects
→ evaluate mandate and local bounds (GrantBoundAutonomyPolicy)
→ reserve usage
→ execute through private port
→ commit or abort
```

The agent can only invoke activities covered by its mandates and local autonomy profile. **Universal enforcement coverage does not mean universal agent access.**

### Ungrantable activities

Some activities can never be invoked by an agent, even if a matching port exists:

- Seed export, private keys, session seeds
- Raw signing primitives
- WOTS key-lease reserve/commit/burn
- Policy replacement
- Unrestricted raw port handles
- Identity-root rotation (unless routed through a dedicated governance flow)

These are rejected before any port is touched. Key-lease operations remain **internal consequences** of an authorized signing action — the runtime reserves the key, signs, then commits (or burns on failure) automatically.

### Effects from real transactions

Spend actions (`payment:send`, `omnia:pay`, `omnia:settle`, `omnia:splice-out`, `omnia:pay-multihop`) derive their canonical effects from the **real built transaction**, never from agent-supplied hints. When an `EdgeTxBuilderContext` is supplied, the wallet builds the tx first (coin selection + outputs), then:

- change outputs back to the wallet's own addresses are **excluded** from spends;
- channel-internal outputs back to the channel script are **excluded** (state change, not spend);
- the committed receipt reflects the real spend, not the agent's claimed amount.

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

### Governed agent runtime

Wire the action registry, builtin definitions, and a `GrantBoundAutonomyPolicy` into the agent facade. The agent gets only `executeAction` — no raw ports.

```typescript
import {
  createEdgeActionRegistry,
  createBuiltinActionDefinitions,
  createAgentEdgeRuntime,
  createCapabilitySet,
} from '@totemsdk/edge';
import { GrantBoundAutonomyPolicy, MemoryRunStateStore } from '@totemsdk/agent-policy';

// 1. Build the policy (mandates + local autonomy profile).
const policy = new GrantBoundAutonomyPolicy({
  autonomyProfiles: { 'edge-agent': { profileId: 'edge-agent', mode: 'dynamic', runLimits: { maxSteps: 20, maxGrossSpend: { tokenId: '0x00', amount: '500' } } } },
  mandateResolver: async (id) => mandateProofs[id],
  identityResolver,
  stateStore: new MemoryRunStateStore(),
});
await policy.openRun({ runId: 'run-1', agentId: 'ag', principal: 'MxFleet', grantProofIds: ['proof:owner-grant'], profileId: 'edge-agent' });

// 2. Register the builtin action definitions against the ports.
const registry = createEdgeActionRegistry();
for (const { action, def } of createBuiltinActionDefinitions(ports)) {
  registry.register(def, action);
}

// 3. The agent receives ONLY this facade.
const agent = createAgentEdgeRuntime({
  deviceId: 'dev-1',
  capabilities: createCapabilitySet(['payment:send', 'lookup:watch']),
  registry,
  policy,
  runId: 'run-1',
  principal: 'MxFleet',
  agentId: 'ag',
});

const result = await agent.executeAction({
  action: 'payment:send',
  subject: 'MxRECIPIENT',
  payload: { amount: '10', tokenId: '0x00' },
});
// result.ok === true → authorized, executed, committed to the run receipt graph.
// result.errorCode === 'REQUIRES_HUMAN' → ceiling hit; result.policyResult.suggestedGrant
//   carries a narrow, expiring, run-bound grant amendment.
```

### Effects from a real built transaction

Supply an `EdgeTxBuilderContext` so spend actions authorize the **real** tx, not the agent's claimed amount:

```typescript
import { createBuiltinActionDefinitions } from '@totemsdk/edge';

const txBuilder = {
  buildPaymentTx: async ({ recipient, amount, tokenId }) => {
    // wallet does coin selection + output construction here
    return {
      params: {
        inputs: [{ address: 'MxWALLET', amount: '100', tokenId: '0x00' }],
        outputs: [
          { address: recipient, amount, tokenId },
          { address: 'MxWALLET', amount: '60', tokenId: '0x00' }, // change
        ],
      },
      ownAddresses: ['MxWALLET'],
    };
  },
};

for (const { action, def } of createBuiltinActionDefinitions(ports, undefined, txBuilder)) {
  registry.register(def, action);
}
// The committed receipt reflects the real spend (40), not the agent's claim (100).
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

### `createEdgeActionRegistry()`

Universal action registry. `register(def, action | action[])` accepts exact actions and `domain:*` prefixes; `resolve(action)` returns the matching definition. Registering an ungrantable action throws.

```typescript
interface EdgeActionDefinition {
  capability: EdgeCapability;
  effect: 'read' | 'write' | 'sign' | 'spend' | 'publish' | 'admin';
  prepare(input: EdgeActionInput): unknown | Promise<unknown>;
  deriveEffects(prepared: unknown): StepEffects;
  execute(prepared: unknown): Promise<EdgeOperationResult>;
}
```

### `createBuiltinActionDefinitions(ports, trusted?, txBuilder?)`

Returns `{ action, def }[]` for every canonical namespace: `payment:send`, `omnia:*` (12 ops), `proof:create/verify`, `lookup:query/announce`, `location:claim:create/trail:create/proof:create`, `identity:resolve/verify`, `manifest:sign/verify`, `liquidity:balance:read/utxo:read`, `transport:publish/subscribe/send`.

- `trusted` — `{ manifestSeed?, manifestKeyIndex?, signingKeyIndex? }`. The agent never supplies a seed; signing uses the trusted wallet key, and the key-lease lifecycle (reserve → sign → commit/burn) is an internal consequence of the action.
- `txBuilder` — `{ buildPaymentTx?, buildChannelUpdateTx? }`. When supplied, spend actions build the tx first and derive effects from the real outputs.

### `createAgentEdgeRuntime(opts)`

The governed agent facade. Exposes only `executeAction` — never the raw ports.

```typescript
function createAgentEdgeRuntime(opts: {
  deviceId: string;
  capabilities: EdgeCapabilitySet;
  registry: EdgeActionRegistry;
  policy: GrantBoundAutonomyPolicy;
  runId: string;
  principal: string;
  agentId: string;
  now?: () => number;
}): AgentEdgeRuntime;
```

### `deriveEffectsFromBuiltTx` / `deriveSpendsFromBuiltTx`

Derive canonical security facts from a real built transaction. Change outputs (back to the wallet's own addresses) and channel-internal outputs (back to the channel script) are excluded from spends.

```typescript
function deriveSpendsFromBuiltTx(tx: BuiltTransaction): Array<{ tokenId: string; amount: string; recipient: string }>;
function deriveEffectsFromBuiltTx(tx: BuiltTransaction): StepEffects;
function fromEnhancedBuildParams(params, ownAddresses: string[]): BuiltTransaction;
function fromOmniaTxDraft(draft, channelScriptAddress: string, channelOps?): BuiltTransaction;
```

### `isUngrantableAction(action)` / `UNGRANTABLE_ACTIONS`

Hard deny-list for activities the agent can never invoke directly: seed export, private keys, raw signing, key-lease reserve/commit/burn, policy replacement, raw port handles, identity-root rotation.

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
