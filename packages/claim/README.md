# `@totemsdk/claim`

Payload-agnostic claim envelope and policy semantics for Totem Edge.

A claim is a bearer right: a **payload** (what is being claimed) and a **policy**
(who may claim it, when, and under what conditions). This package owns those
two nouns and the pure verbs over them. It does not own campaigns, reservations,
wallets, persistence, transport or settlement.

```ts
import {
  evaluateClaim,
  computeVestingSchedule,
  computeClaimEnvelopeHash,
  type ClaimEnvelope,
} from '@totemsdk/claim';

const envelope: ClaimEnvelope = {
  version: 1,
  payload: { kind: 'token', tokenId: '0x00', amount: '10000000', decimals: 8 },
  policy: {
    type: 'vesting',
    owner: 'MxTreasury',
    beneficiary: 'MxAlice',
    startBlock: 100,
    cliffBlock: 200,
    endBlock: 500,
    totalAmount: 10_000_000n,
  },
};

const schedule = computeVestingSchedule(envelope.policy as any, 300);
const result = evaluateClaim(envelope.policy, {
  signers: ['MxAlice'],
  claimAmount: 2_500_000n,
}, { block: 300 });

console.log(schedule, result, computeClaimEnvelopeHash(envelope));
```

## What belongs here

- The four-layer envelope: payload, policy, version, opaque metadata.
- Core payload descriptors: native, token, NFT, basket, VTXO, statechain,
  liquidity position, proof, manifest, mandate, data, custom.
- The policy union: `single`, `threshold`, `conditional`, `dvp`, `delegated`,
  `rotation`, `vesting`, `recovery`, `collateral`.
- `evaluateClaim` — pure authorization, no signatures, no chain access.
- Vesting arithmetic and the canonical envelope hash.

## What does not

- Signature verification and canonical preimages — those belong to the
  settlement adapter (for VTXO, `@totemsdk/vtxo`).
- Campaigns, deadlines, reclaim rules, refunds and manual review.
- Persistence, HTTP, email, issuer auth and UI.
- Chain observation and transaction delivery.

## Status

`0.1.0` — initial extraction from `@totemsdk/vtxo`'s VTXO claim policies.
The VTXO package re-exports the generic types for compatibility.
