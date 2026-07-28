# @totemsdk/identity

Canonical identity and claims layer for Totem Edge — who controls a manifest, device, or agent.

No network. No DHT. No blockchain submission. Pure schema + cryptographic binding.

## Installation

```bash
npm install @totemsdk/identity
```

## Overview

`@totemsdk/identity` ties together manifests, device identifiers, and agent credentials into a single coherent identity model. It provides:

- **Identity documents** — a `TotemIdentityDocument` naming a root Minima address and a current controller address
- **Claims** — typed assertions linking identities (delegation, payment routing, service endpoints, rotation, revocation)
- **Sign / verify** — WOTS-signed claim envelopes with self-contained verification
- **Graph resolution** — walk a set of signed claims to produce a `ResolvedIdentity` showing active delegates, payment recipients, service endpoints, and rotation/revocation status
- **Manifest binding** — cryptographically bind a `SignedManifest` to an identity document

## All exports

### Document

| Export | Description |
|--------|-------------|
| `createIdentityDocument(opts)` | Create a new `TotemIdentityDocument` |
| `computeIdentityId(kind, rootAddress)` | SHA3-256 over stable identity fields — returns `totem:id:<kind>:<hash>` URI |

### Claims

| Export | Description |
|--------|-------------|
| `createIdentityClaim(opts)` | Create a generic `IdentityClaim` |
| `createDelegationClaim(opts)` | `delegates_to` claim — authorize another address |
| `createPaymentRecipientClaim(opts)` | `payment_recipient` claim — register a payment address |
| `createServiceEndpointClaim(opts)` | `service_endpoint` claim — register a service URI |

### Sign / Verify

| Export | Description |
|--------|-------------|
| `signIdentityClaim(claim, seed, keyIndex)` | WOTS-sign a claim; returns `SignedIdentityClaim` |
| `verifyIdentityClaim(signed)` | Verify the WOTS signature; returns `IdentityVerifyResult` |

### Rotation and Revocation

| Export | Description |
|--------|-------------|
| `rotateIdentity(doc, newAddress, seed, keyIndex)` | Issue a signed `rotates_to` claim |
| `revokeIdentity(doc, reason, seed, keyIndex)` | Issue a signed `revokes` claim |

### Resolution

| Export | Description |
|--------|-------------|
| `resolveIdentityGraph(graph)` | Walk an `IdentityGraph` to produce `IdentityResolutionResult` |

### Manifest Binding

| Export | Description |
|--------|-------------|
| `bindManifestToIdentity(signedManifest, graph)` | Verify a `SignedManifest` against an `IdentityGraph`; returns `ManifestIdentityBinding` |
| `verifyManifestIdentity(signedManifest, graph)` | Core verification logic (called internally by `bindManifestToIdentity`) |

### Type Guards

| Export | Description |
|--------|-------------|
| `isTotemIdentityDocument(x)` | Narrows to `TotemIdentityDocument` |
| `isIdentityClaim(x)` | Narrows to `IdentityClaim` |
| `isSignedIdentityClaim(x)` | Narrows to `SignedIdentityClaim` |
| `isRotationClaim(x)` | Narrows to `RotationClaim` |
| `isRevocationClaim(x)` | Narrows to `RevocationClaim` |

## Type reference

### `TotemIdentityDocument`

```typescript
interface TotemIdentityDocument {
  id: string;                          // computeIdentityId(kind, rootAddress) — totem:id:... URI
  kind: IdentityKind;
  version: number;
  rootAddress: string;                 // Minima address — permanent, never changes
  controllerAddress: string;           // Current active controlling address
  createdAt: number;                   // Unix ms
  metadata?: Record<string, unknown>;
}

type IdentityKind =
  | 'person' | 'device' | 'agent' | 'service'
  | 'organization' | 'sensor' | 'robot' | 'gateway';
```

### `IdentityClaim`

```typescript
interface IdentityClaim {
  id: string;
  type: IdentityClaimType;
  issuer: string;          // Minima address of the claim issuer
  subject: string;         // identityId this claim is about
  object: string;          // target address or identityId
  issuedAt: number;        // Unix ms
  expiresAt?: number;      // Unix ms — absent means no expiry
  payload: Record<string, unknown>;
}

type IdentityClaimType =
  | 'delegates_to'
  | 'payment_recipient'
  | 'service_endpoint'
  | 'rotates_to'
  | 'revokes';
```

### `SignedIdentityClaim`

```typescript
interface SignedIdentityClaim {
  claim: IdentityClaim;
  proof: {
    address: string;       // Minima address that signed
    publicKey: string;     // Full WOTS public key hex
    signature: string;     // WOTS signature hex
    message?: string;      // Optional human-readable signing context
  };
  rootIdentityProof?: string;
}
```

### Concrete claim types

```typescript
interface DelegationClaim {
  claimId: string;
  issuer: string;
  subject: string;
  delegatedAddress: string;  // Hot-key address authorized to act on behalf of root
  scopes: string[];           // e.g. ['manifest:sign', 'proof:create']
  issuedAt: number;
  expiresAt?: number;
}

interface PaymentRecipientClaim {
  claimId: string;
  issuer: string;
  address: string;            // Minima address for receiving payments
  label?: string;
  issuedAt: number;
  expiresAt?: number;
}

interface ServiceEndpointClaim {
  claimId: string;
  issuer: string;
  endpointType: string;       // e.g. 'mqtt', 'https', 'hyperswarm'
  uri: string;
  issuedAt: number;
  expiresAt?: number;
}

interface RotationClaim {
  claimId: string;
  issuer: string;
  subject: string;
  newAddress: string;         // Address the identity has rotated to
  issuedAt: number;
}

interface RevocationClaim {
  claimId: string;
  issuer: string;
  subject: string;
  reason?: string;
  issuedAt: number;
}
```

### `ResolvedIdentity`

```typescript
interface ResolvedIdentity {
  document: TotemIdentityDocument;
  status: 'active' | 'rotated' | 'revoked';
  rootAddress: string;
  controllerAddress: string;
  controlledAddresses: string[];
  authorizedAddresses: string[];
  delegates: DelegationClaim[];
  paymentRecipients: PaymentRecipientClaim[];
  serviceEndpoints: ServiceEndpointClaim[];
  rotationTarget?: string;
  revokedAt?: number;
}
```

### `IdentityVerifyResult`

```typescript
interface IdentityVerifyResult {
  valid: boolean;
  reason?: string;
  signerAddress?: string;
  rootAddress?: string;
  provenAddresses?: string[];
  metadata?: Record<string, unknown>;
}
```

### `ManifestIdentityBinding`

```typescript
interface ManifestIdentityBinding {
  valid: boolean;
  reason?: string;
  manifestId: string;
  identityId: string;
  signerAddress: string;
  resolvedStatus: 'active' | 'rotated' | 'revoked';
}
```

## Usage: create → sign → resolve → bind

```typescript
import {
  createIdentityDocument,
  computeIdentityId,
  createDelegationClaim,
  signIdentityClaim,
  verifyIdentityClaim,
  resolveIdentityGraph,
  bindManifestToIdentity,
} from '@totemsdk/identity';
import { signManifest } from '@totemsdk/manifest';

// 1. Create identity document
const doc = createIdentityDocument({
  kind: 'service',
  rootAddress: 'MxABC123...',
  controllerAddress: 'MxABC123...',
});
// computeIdentityId(kind, rootAddress) matches doc.id — use to derive it independently
console.log('Identity ID:', computeIdentityId('service', 'MxABC123...'));

// 2. Delegate a hot key
const delegationClaim = createDelegationClaim({
  issuer: doc.rootAddress,
  subject: doc.id,
  delegatedAddress: 'MxHOT456...',
  scopes: ['manifest:sign'],
});

// seed = 32-byte WOTS seed; keyIndex = reserved via @totemsdk/wots-lease
const signedDelegation = await signIdentityClaim(delegationClaim, seed, keyIndex);

// 3. Verify immediately
const verifyResult = await verifyIdentityClaim(signedDelegation);
console.assert(verifyResult.valid, 'Claim signature invalid');

// 4. Resolve the full graph
const { resolved, errors } = resolveIdentityGraph({
  document: doc,
  claims: [signedDelegation],
});
console.log('Status:', resolved?.status);           // 'active'
console.log('Delegates:', resolved?.delegates);     // [DelegationClaim]

// 5. Bind a manifest — bindManifestToIdentity takes an IdentityGraph, not a document
const signedManifest = await signManifest(edgeServiceManifest, seed, keyIndex2);
const binding = await bindManifestToIdentity(signedManifest, {
  document: doc,
  claims: [signedDelegation],
});
console.assert(binding.valid, 'Manifest not bound to identity');
```

## Security notes

### Issuer verification

`verifyIdentityClaim` only checks that the WOTS signature is valid for `proof.address`. It does **not** check whether the issuer is trusted — that is the role of `resolveIdentityGraph`.

Always resolve the full graph before acting on claims:
- A claim where `issuer` is not the `rootAddress` or a currently authorized address is silently excluded by the resolver.
- `rotates_to` and `revokes` claims from unauthorized issuers are ignored.
- An attacker who signs a claim but sets `issuer = rootAddress` will be caught: the resolver checks that `proof.address` matches the declared `issuer`, not just that the signature is structurally valid.

### One-time WOTS keys

Each claim signature consumes one WOTS key index. Use `@totemsdk/wots-lease` to reserve indexes before calling `signIdentityClaim`. Reusing an index exposes the private key.

## Related packages

- [`@totemsdk/manifest`](https://www.npmjs.com/package/@totemsdk/manifest) — signed declaration format for Totem Edge entities
- [`@totemsdk/edge`](https://www.npmjs.com/package/@totemsdk/edge) — compose identity into an edge runtime
- [`@totemsdk/core`](https://www.npmjs.com/package/@totemsdk/core) — WOTS signing primitives used internally
- [`@totemsdk/root-identity`](https://www.npmjs.com/package/@totemsdk/root-identity) — multi-address root identity SDK

## License

MIT
