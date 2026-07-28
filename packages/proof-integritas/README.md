# @totemsdk/proof-integritas

[Integritas v2](https://integritas.minima.global/core/v2) proof provider adapter for [`@totemsdk/proof`](https://www.npmjs.com/package/@totemsdk/proof) — hash stamping, checking, and on-chain verification on Minima.

## Installation

```bash
npm install @totemsdk/proof-integritas
```

## Overview

Integritas is a hosted hash-anchoring service that writes SHA3-256 commitment hashes to the Minima blockchain. `@totemsdk/proof-integritas` wraps the Integritas v2 REST API as a `ProofProvider` so any `@totemsdk/proof` consumer can anchor, check, and verify proofs on-chain with a single method call.

What this package **does**:
- Stamp, check, and verify arbitrary hex hashes via Integritas
- Anchor `SignedProof` objects — computes the canonical `createAnchorCommitment` hash and stamps it
- Verify proofs locally (WOTS signature) first, then confirm on-chain via Integritas
- Map all API responses to structured `ProofOperationResult` / `ProofVerifyResult` — never throws on network errors

What this package **does not** do:
- WOTS signing — use [`@totemsdk/proof`](https://www.npmjs.com/package/@totemsdk/proof)
- proofgraph construction — use [`@totemsdk/proofgraph`](https://www.npmjs.com/package/@totemsdk/proofgraph)
- OAuth — only `x-api-key` header authentication

## Capabilities

```
hash:stamp  hash:check  hash:verify
proof:anchor  proof:check  proof:verify
report:pdf  nft:trace  minima:onchain
```

## Quick start

```typescript
import { createIntegritasProofProvider } from '@totemsdk/proof-integritas';
import { createProof, signProof } from '@totemsdk/proof';

const provider = createIntegritasProofProvider({
  apiKey: process.env.INTEGRITAS_API_KEY,
  baseUrl: 'https://integritas.minima.global/core/v2', // default
});

// Stamp a raw hash
const stamp = await provider.stampHash({ hash: 'deadbeef...' });
console.log(stamp.ok, stamp.data);   // { ok: true, data: { hash, txId, timestamp } }

// Anchor a signed proof (computes createAnchorCommitment internally)
const signed = signProof(createProof({ kind: 'attestation', subject: { id: '...', kind: 'device' }, issuer: 'Mx...' }), seed, 0);
const anchored = await provider.anchorProof(signed);
console.log(anchored.data.anchorRef);  // { provider: 'integritas', hash, txId }

// Verify on-chain (local WOTS check first, then Integritas)
const verified = await provider.verifyProof(signed);
console.log(verified.valid, verified.signerAddress);
```

## All exports

### Factory

| Export | Description |
|--------|-------------|
| `createIntegritasProofProvider(config)` | Returns an object implementing `ProofProvider` |

### Normalization helpers

| Export | Description |
|--------|-------------|
| `normalizeIntegritasStampResponse(raw)` | Map raw stamp API response → `ProofOperationResult` |
| `normalizeIntegritasCheckResponse(raw)` | Map raw check API response → `ProofOperationResult` |
| `normalizeIntegritasVerifyResponse(raw)` | Map raw verify API response → `ProofVerifyResult` |

### Hash utilities

| Export | Description |
|--------|-------------|
| `integritasHashFromProof(signed)` | Compute the canonical hash to submit to Integritas (`createAnchorCommitment`) |
| `integritasAnchorRefFromResponse(response)` | Map a successful stamp response to an `AnchorRef` |

## Type reference

### `IntegritasConfig`

```typescript
interface IntegritasConfig {
  baseUrl?: string;                    // default: 'https://integritas.minima.global/core/v2'
  apiKey?: string;                     // Sent as x-api-key header
  requestIdFactory?: () => string;     // default: crypto.randomUUID
  fetch?: typeof globalThis.fetch;     // Injected fetch — useful for testing
}
```

### Raw API response types

```typescript
interface IntegritasStampResponse {
  status: string;       // 'ok' | 'error' | …
  hash?: string;
  txId?: string;
  timestamp?: number;   // Unix ms of on-chain confirmation
  message?: string;     // Error description
}

interface IntegritasCheckResponse { /* same shape */ }

interface IntegritasVerifyResponse {
  status: string;       // 'verified' | 'unverified' | 'error' | …
  hash?: string;
  txId?: string;
  timestamp?: number;
  message?: string;
  report?: string;      // PDF report URL (when x-report-required: true)
}
```

### `IntegritasCapability`

```typescript
type IntegritasCapability =
  | 'hash:stamp' | 'hash:check' | 'hash:verify'
  | 'proof:anchor' | 'proof:check' | 'proof:verify'
  | 'report:pdf' | 'nft:trace' | 'minima:onchain';
```

## Provider method reference

### `stampHash({ hash })`

`POST /timestamp/post` — stamps a hex hash. Sets headers `x-api-key`, `x-request-id`, `Content-Type: application/json`.

### `checkHash({ hash })`

`POST /file/check` — checks whether a hash has already been stamped.

### `verifyHash({ hash, reportRequired? })`

`POST /verify/file` — verifies on-chain. If `reportRequired: true`, sets `x-report-required: 'true'` header and the response will include a PDF report URL.

### `anchorProof(signed)`

Computes `createAnchorCommitment(signed)`, calls `stampHash`, and if successful attaches an `AnchorRef` to `result.data.anchorRef`.

### `checkProof(signed)`

Computes the commitment hash and calls `checkHash`.

### `verifyProof(signed, options?)`

1. Runs local WOTS verification via `@totemsdk/proof`.
2. If local fails → returns `{ valid: false }` **without** calling Integritas.
3. If local passes (or `options.skipLocalVerification === true`) → calls `verifyHash`.
4. Merges results — both must pass for `valid: true`.

### Error handling

All methods catch network errors and return a structured failure instead of throwing:

```typescript
// Network error
const result = await provider.stampHash({ hash: 'abc' });
// { ok: false, error: 'Network unreachable', providerRef: 'integritas' }
```

## Testing with a mock fetch

Inject `config.fetch` to avoid real HTTP calls in tests:

```typescript
const mockFetch = jest.fn().mockResolvedValue({
  json: () => Promise.resolve({ status: 'ok', hash: 'abc', txId: 'tx-1' }),
});

const provider = createIntegritasProofProvider({
  fetch: mockFetch,
  apiKey: 'test-key',
  requestIdFactory: () => 'fixed-request-id',
});
```

## Related packages

- [`@totemsdk/proof`](https://www.npmjs.com/package/@totemsdk/proof) — `ProofProvider` interface + WOTS signing
- [`@totemsdk/proofgraph`](https://www.npmjs.com/package/@totemsdk/proofgraph) — graph of proof relationships
- [`@totemsdk/core`](https://www.npmjs.com/package/@totemsdk/core) — WOTS signing primitives
- [`@totemsdk/wots-lease`](https://www.npmjs.com/package/@totemsdk/wots-lease) — WOTS key index reservation

## License

MIT
