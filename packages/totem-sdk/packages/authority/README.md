# @totemsdk/authority

Deterministic authority engine for Totem Edge — mandate verification, scope matching, usage tracking, and authority evaluation on Minima.

Pure package. No network. No DHT. No blockchain submission.

## Installation

```bash
npm install @totemsdk/authority
```

## Overview

`@totemsdk/authority` determines whether an identified actor has verifiable authority to perform a proposed action on behalf of a principal. It answers one question:

> Given a set of identity graphs, a mandate, and a usage snapshot, does the proposed action have verifiable authority?

It is designed to be wrapped by a stateful governance layer (e.g. `@totemsdk/governance`) that manages identity resolution, usage stores, and mandate lifecycle.

## Exports

### Types

| Export | Description |
|--------|-------------|
| `ActionIntent` | A proposed action — who wants to do what to whom |
| `MandateBody` | Core mandate data — grantor, grantee, principal, scope, constraints |
| `MandateConstraint` | Field-level constraint with comparison operators |
| `UsageLimit` | Count, amount, or time-window usage cap |
| `AuthorityUsage` | A single usage record |
| `AuthorityUsageSnapshot` | Aggregated usage at a point in time |
| `MandateStatusSnapshot` | Revocation state for a set of mandates |
| `MandateVerificationResult` | Detailed outcome of mandate verification |
| `AuthorityDecision` | Complete evaluation result with matched/failed rules |
| `AuthorityIdentityResolver` | Interface for resolving identity graphs |

### Deterministic IDs

| Export | Description |
|--------|-------------|
| `computeActionIntentId(intent)` | `totem:intent:<sha3-256>` — strips nonce |
| `computeMandateId(mandate)` | `totem:mandate:<sha3-256>` |
| `computeAuthorityDecisionId(decision)` | `totem:decision:<sha3-256>` |
| `computeUsageSnapshotHash(snapshot)` | `totem:usage:<sha3-256>` |

### Mandate lifecycle

| Export | Description |
|--------|-------------|
| `createAgentMandate(params)` | Build a `MandateBody` |
| `createMandateProofDraft(mandate)` | Build an unsigned proof with `schema: totem:authority:mandate/v1` |
| `signMandateWithLease(unsigned, seed, leaseProvider)` | Sign via WOTS lease provider |
| `signMandateUnsafe(unsigned, seed, keyIndex)` | Sign with raw key index (use with care) |
| `verifyMandate(signed, resolver, now, graceMs?, status?)` | Full verification |

### Scope matching

| Export | Description |
|--------|-------------|
| `matchScope(action, scope)` | Wildcard-supporting scope match |
| `matchConstraints(action, constraints)` | Compare action constraints against mandate constraints |

### Usage

| Export | Description |
|--------|-------------|
| `checkUsageLimit(snapshot, limit, now)` | Check if usage is within bounds |
| `calculateUsageDelta(action)` | Compute the usage delta for an action |
| `snapshotFromUsage(usages, now, limit?)` | Build a usage snapshot from records |

### Evaluation

| Export | Description |
|--------|-------------|
| `evaluateAuthority(params)` | Pure evaluation — returns `{ decision, usageDelta }` |

## Usage

```typescript
import { evaluateAuthority, createAgentMandate, createMandateProofDraft, signMandateUnsafe, verifyMandate } from '@totemsdk/authority';
import type { AuthorityIdentityResolver, AuthorityUsageSnapshot } from '@totemsdk/authority';

// 1. Create a mandate
const mandate = createAgentMandate({
  grantor: 'MxGRANTOR...',
  grantee: 'MxAGENT...',
  principal: 'totem:id:device:abc',
  scope: 'data:read',
});

// 2. Sign it (seed from @totemsdk/core or wallet)
const draft = createMandateProofDraft(mandate);
const signed = signMandateUnsafe(draft, seed, keyIndex);

// 3. Verify the mandate
const identityResolver: AuthorityIdentityResolver = {
  resolve: (id) => identityGraphs.get(id),
};
const result = verifyMandate(signed, identityResolver, Date.now());
console.assert(result.valid, result.reason);

// 4. Evaluate an action
const { decision, usageDelta } = evaluateAuthority({
  action: { action: 'data:read', principal: 'totem:id:device:abc', agent: 'MxAGENT...' },
  mandate: signed,
  identityResolver,
  usageSnapshot: { mandateProofId: '', totalCount: 0 },
  now: Date.now(),
});

if (decision.allowed) {
  // apply usageDelta to the usage store
}
```

## Related packages

- [`@totemsdk/proof`](https://www.npmjs.com/package/@totemsdk/proof) — portable proof envelopes (WOTS-signed)
- [`@totemsdk/identity`](https://www.npmjs.com/package/@totemsdk/identity) — identity claims and resolution
- [`@totemsdk/core`](https://www.npmjs.com/package/@totemsdk/core) — WOTS signing, address derivation

## License

MIT
