# @totemsdk/manifest

**Canonical signed declarations for every Totem Edge entity.**

Defines the schema, deterministic IDs, wire encoding, WOTS signing, and type guards for all manifest types in the Totem ecosystem. Every entity that wants to be discovered, paid, or trusted — an app, an AI agent capability, a smart contract, or a persistent edge service — is represented as a `SignedManifest`.

No network. No blockchain. No Hyperswarm. Pure schema + cryptographic binding.

## Install

```bash
npm install @totemsdk/manifest
```

## What's inside

| Type | Role |
|------|------|
| `AppManifest` | A human-facing Pear app — name, version, permissions, pricing, install topic key |
| `CapabilityManifest` | An ephemeral AI/agent service — input/output schema, per-call pricing, expiry |
| `DAppManifest` | A KISSVM smart contract / covenant — contract hash, ABI, audit report |
| `EdgeServiceManifest` | Any persistent Totem Edge service — sensors, robots, MQTT feeds, Omnia routers, lookup providers, proof indexers, and more |
| `SignedManifest<T>` | Wraps any manifest with a WOTS signature and signer address |
| `VerifyResult` | Result of `verifyManifest` — `valid`, optional `reason`, `signerAddress` |

## Usage

### Sign a manifest

```typescript
import { signManifest } from '@totemsdk/manifest';
import type { AppManifest } from '@totemsdk/manifest';

const app: AppManifest = {
  type: 'app',
  appId: computeManifestId(app),   // fill after construction
  name: 'My dApp',
  version: '1.0.0',
  authorAddress: 'MxABC123...',
  pearTopicKey: 'a1b2c3...',       // 32-byte hex — Hyperswarm install topic
  price: '0',
  category: ['finance'],
  permissions: ['wallet:read-balance', 'wallet:request-payment'],
  description: 'My first Totem app',
  minTotemVersion: '0.1.0',
};

// seed = your 32-byte WOTS seed; keyIndex = pre-reserved key index
const signed = await signManifest(app, seed, keyIndex);
// signed.authorAddress — the Minima address of the signer
// signed.signature    — WOTS signature hex
```

### Verify a manifest

```typescript
import { verifyManifest } from '@totemsdk/manifest';

const result = verifyManifest(signed);
if (!result.valid) {
  console.error('Invalid manifest:', result.reason);
}
```

### Compute a stable manifest ID

```typescript
import { computeManifestId } from '@totemsdk/manifest';

// ID is SHA3-256 over stable key fields — does not change when version changes
const id = computeManifestId(app);
```

### Wire encode / decode

```typescript
import { encodeManifest, decodeManifest } from '@totemsdk/manifest';

// Encode to Uint8Array for DHT / lookup-protocol embedding
const bytes = encodeManifest(signed);

// Decode back from bytes (validates type discriminant and version)
const decoded = decodeManifest(bytes);
```

Wire format: `[1 version][1 type][4-byte JSON length][JSON payload][WOTS signature]`

### Type guards

```typescript
import {
  isAppManifest,
  isCapabilityManifest,
  isDAppManifest,
  isEdgeServiceManifest,
} from '@totemsdk/manifest';

// Accept raw Manifest or SignedManifest<T>
if (isCapabilityManifest(signed)) {
  console.log(signed.manifest.capabilityName);
}
```

## Manifest types

### `AppManifest`

```typescript
interface AppManifest {
  type: 'app';
  appId: string;             // SHA3-256(authorAddress + pearTopicKey)
  name: string;
  version: string;           // semver
  authorAddress: string;     // Minima address
  pearTopicKey: string;      // 32-byte hex — Hyperswarm install topic
  price: string;             // '0' for free; Minima amount for paid
  priceToken?: string;
  subscriptionInterval?: number;
  category: string[];
  permissions: AppPermission[];
  iconCid?: string;
  description: string;
  repoUrl?: string;
  minTotemVersion: string;
}
```

### `CapabilityManifest`

```typescript
interface CapabilityManifest {
  type: 'capability';
  capabilityId: string;      // SHA3-256(agentAddress + capabilityName)
  capabilityName: string;
  agentAddress: string;
  agentIdentityKey: string;  // ed25519 pubkey for auth challenge/response
  description: string;
  inputSchema: object;       // JSON Schema
  outputSchema: object;      // JSON Schema
  pricePerCall: string;
  priceToken?: string;
  paymentChannel?: 'omnia' | 'onchain';
  maxLatencyMs?: number;
  maxCallsPerMinute?: number;
  expiresAt: number;         // ms — must be re-announced
  tags: string[];
}
```

### `DAppManifest`

```typescript
interface DAppManifest {
  type: 'dapp';
  dappId: string;            // SHA3-256(authorAddress + contractHash)
  name: string;
  version: string;
  authorAddress: string;
  contractHash: string;      // SHA3-256 of the KISSVM script
  contractSource?: string;
  abi: DAppAbiEntry[];
  price: string;
  priceToken?: string;
  category: string[];
  description: string;
  auditReport?: string;      // CID of a simulation audit result
}
```

### `EdgeServiceManifest`

Covers all persistent Totem Edge services that are not apps, capabilities, or dApps.

```typescript
type EdgeServiceType =
  | 'sensor'
  | 'robot'
  | 'mqtt-feed'
  | 'proof-index'
  | 'lookup-provider'
  | 'omnia-router'
  | 'calibration-authority'
  | 'verifier'
  | 'machine-service'
  | 'other';

interface EdgeServiceManifest {
  type: 'edge-service';
  serviceId: string;         // SHA3-256(operatorAddress + serviceType + name)
  name: string;
  version: string;
  operatorAddress: string;
  serviceType: EdgeServiceType;
  description: string;
  endpoints?: Array<{
    type: 'https' | 'mqtt' | 'hyperswarm' | 'websocket' | 'other';
    uri: string;
  }>;
  capabilities: string[];
  price?: string;
  priceToken?: string;
  paymentMethods?: Array<'omnia' | 'onchain' | 'invoice' | 'free'>;
  tags: string[];
  expiresAt?: number;
  minTotemVersion?: string;
}
```

## Wire type discriminants

| Type | Byte |
|------|------|
| `app` | `0x01` |
| `capability` | `0x02` |
| `dapp` | `0x03` |
| `edge-service` | `0x04` |

## See also

- [`@totemsdk/core`](https://www.npmjs.com/package/@totemsdk/core) — WOTS signing primitives used internally
- [`@totemsdk/lookup-protocol`](https://www.npmjs.com/package/@totemsdk/lookup-protocol) — embeds `encodeManifest()` output in `APP_ANNOUNCE` / `AGENT_ANNOUNCE` messages
- [`@totemsdk/wots-lease`](https://www.npmjs.com/package/@totemsdk/wots-lease) — manage WOTS key index reservation before calling `signManifest`
- [`@totemsdk/root-identity`](https://www.npmjs.com/package/@totemsdk/root-identity) — optional `rootIdentityProof` field for chain-of-custody linking
