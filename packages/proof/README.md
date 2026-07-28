# @totemsdk/proof

Portable proof layer for Totem Edge — create, sign, verify, and anchor WOTS-signed proof envelopes on Minima.

No network. No DHT. No blockchain submission. Pure cryptographic proof primitives.

## Installation

```bash
npm install @totemsdk/proof
```

## Overview

`@totemsdk/proof` gives you a self-contained proof envelope type (`SignedProof`) with full lifecycle support:

- **Create** — build a typed proof over any subject with evidence, links, and expiry
- **Sign** — WOTS-sign the canonical JSON of the proof using any Minima key index
- **Verify** — recompute the digest from scratch and verify the WOTS signature
- **Anchor** — compute a deterministic `createAnchorCommitment` hash suitable for on-chain stamping via [`@totemsdk/proof-integritas`](https://www.npmjs.com/package/@totemsdk/proof-integritas)
- **Extend** — implement `ProofProvider` to plug in any anchoring backend

## All exports

### Lifecycle

| Export | Description |
|--------|-------------|
| `createProof(params)` | Build an `UnsignedProof` with a computed `proofId` |
| `signProof(unsigned, seed, keyIndex)` | WOTS-sign an `UnsignedProof`; returns `SignedProof` |
| `verifyProof(signed, options?)` | Full combined check — signature + expiry; returns `ProofVerifyResult` |
| `verifyProofSignature(signed)` | Signature-only check — returns `boolean` |
| `verifyProofPayload(signed)` | Expiry-only check — returns `boolean` |

### Anchoring

| Export | Description |
|--------|-------------|
| `createAnchorCommitment(signed)` | Deterministic SHA3-256 hash of a proof — submit to an anchoring provider |
| `attachAnchor(signed, anchorRef)` | Attach an `AnchorRef` to a `SignedProof` without changing `proofId` |
| `verifyAnchorRef(signed, anchorRef)` | Recompute the commitment and compare against `anchorRef.hash` |

### Specialised proof helpers

| Export | Description |
|--------|-------------|
| `createManifestProof(params)` | Build an unsigned proof bound to a `SignedManifest` |
| `verifyManifestProof(signed)` | Verify a manifest proof — signature + manifest binding |
| `createIdentityProof(params)` | Build an unsigned proof bound to an identity document |
| `verifyIdentityProof(signed)` | Verify an identity proof |

### Canonical helpers

| Export | Description |
|--------|-------------|
| `computeProofId(unsigned)` | SHA3-256 of the canonical JSON of an unsigned proof |
| `hashProofPayload(proof)` | Hash the `payload` field for comparison |
| `hashEvidence(evidence)` | Hash an array of `EvidenceRef` entries for deduplication |
| `toHex(bytes)` | Uint8Array → lowercase hex string (no 0x prefix) |
| `canonicalJson(value)` | Deterministic JSON — sorted keys, no `undefined` values |

## Type reference

### `ProofKind`

```typescript
type ProofKind =
  | 'attestation' | 'ownership' | 'capability'
  | 'revocation'  | 'delegation' | 'manifest'
  | 'identity'    | 'custom';
```

### `UnsignedProof`

```typescript
interface UnsignedProof {
  proofId: string;          // totem:proof:<sha3-256-hex>
  kind: ProofKind;
  subject: ProofSubject;
  issuer: string;           // Minima address or DID
  issuedAt: number;         // Unix ms
  expiresAt?: number;
  evidence?: EvidenceRef[];
  links?: ProofLink[];
  payload?: Record<string, unknown>;
}
```

### `SignedProof`

```typescript
interface SignedProof extends UnsignedProof {
  signature: {
    address: string;        // Minima address derived from the signing key
    publicKey: string;      // WOTS PKdigest hex (32 bytes)
    signature: string;      // WOTS signature hex (1088 bytes)
    message?: string;       // Optional debug context — never used in verification
  };
  anchor?: AnchorRef;
  rootIdentityProof?: string;
}
```

### `AnchorRef`

```typescript
interface AnchorRef {
  provider: string;         // e.g. 'integritas'
  hash: string;             // Hex commitment submitted to the provider
  txId?: string;            // On-chain transaction ID (after confirmation)
  confirmedAt?: number;     // Unix ms of on-chain confirmation
  metadata?: Record<string, unknown>;
}
```

### `ProofVerifyResult`

```typescript
interface ProofVerifyResult {
  valid: boolean;
  expired?: boolean;
  reason?: string;
  signerAddress?: string;
}
```

### `ProofOperationResult`

```typescript
interface ProofOperationResult {
  ok: boolean;
  data?: unknown;
  error?: string;
  providerRef?: string;
}
```

### `ProofProvider`

```typescript
interface ProofProvider {
  readonly capabilities: ProofProviderCapability[];
  stampHash?(params: { hash: string }): Promise<ProofOperationResult>;
  checkHash?(params: { hash: string }): Promise<ProofOperationResult>;
  verifyHash?(params: { hash: string; reportRequired?: boolean }): Promise<ProofVerifyResult>;
  anchorProof?(proof: SignedProof): Promise<ProofOperationResult>;
  checkProof?(proof: SignedProof): Promise<ProofOperationResult>;
  verifyProof?(proof: SignedProof, options?: { skipLocalVerification?: boolean }): Promise<ProofVerifyResult>;
}

type ProofProviderCapability =
  | 'hash:stamp' | 'hash:check' | 'hash:verify'
  | 'proof:anchor' | 'proof:check' | 'proof:verify';
```

## Usage

```typescript
import {
  createProof,
  signProof,
  verifyProof,
  createAnchorCommitment,
  attachAnchor,
} from '@totemsdk/proof';

// 1. Create
const unsigned = createProof({
  kind: 'attestation',
  subject: { id: 'totem:subject:device:abc123', kind: 'device' },
  issuer: 'MxROOT...',
  evidence: [{ id: 'ev-1', kind: 'hash', hash: 'deadbeef...' }],
});

// 2. Sign  (seed = 32-byte WOTS seed; keyIndex from @totemsdk/wots-lease)
const signed = signProof(unsigned, seed, keyIndex);

// 3. Verify
const result = verifyProof(signed);
console.assert(result.valid, result.reason);
console.log('Signer:', result.signerAddress);

// 4. Anchor — compute the commitment, pass it to your anchoring provider
const commitment = createAnchorCommitment(signed);
// ... submit commitment to Integritas or any on-chain service ...

// 5. Attach the AnchorRef back to the proof
const anchored = attachAnchor(signed, {
  provider: 'integritas',
  hash: commitment,
  txId: '0xabc...',
  confirmedAt: Date.now(),
});
```

## Security notes

### Signature scope

`signProof` digests the full `UnsignedProof` including `proofId`. `verifyProof` strips `signature`, `anchor`, and `rootIdentityProof` before recomputing — ensuring the digest is computed over exactly the same fields that were signed. `signature.message` is never used during verification.

### One-time WOTS keys

Each `signProof` call consumes one WOTS key index. Use [`@totemsdk/wots-lease`](https://www.npmjs.com/package/@totemsdk/wots-lease) to reserve indexes before signing. Reusing an index leaks the private key.

### Anchor vs signature

`createAnchorCommitment` produces a hash that is submitted to an anchoring provider. It is **separate** from the WOTS signature — anchoring a proof does not re-sign it. The `AnchorRef` is attached after confirmation and sits outside the signed region of `SignedProof`.

## Related packages

- [`@totemsdk/proofgraph`](https://www.npmjs.com/package/@totemsdk/proofgraph) — queryable DAG of proof relationships
- [`@totemsdk/proof-integritas`](https://www.npmjs.com/package/@totemsdk/proof-integritas) — Integritas v2 anchoring provider
- [`@totemsdk/identity`](https://www.npmjs.com/package/@totemsdk/identity) — identity claims and resolution
- [`@totemsdk/core`](https://www.npmjs.com/package/@totemsdk/core) — WOTS signing primitives
- [`@totemsdk/wots-lease`](https://www.npmjs.com/package/@totemsdk/wots-lease) — WOTS key index reservation

## License

MIT
