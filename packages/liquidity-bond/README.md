# @totemsdk/liquidity-bond

Deterministic, non-custodial LP position and productive liquidity record package for Totem Edge.

## What liquidity-bond is

`@totemsdk/liquidity-bond` is a **small, deterministic, non-custodial v0.1 package for recording and verifying productive bonded liquidity positions**. It answers:

- Who supplied liquidity?
- What pool/router/channel/factory/RFQ reserve is it associated with?
- What asset was committed?
- What are the lock terms?
- What position receipt proves the LP's claim?
- What allocations exist?
- What fee records have been attached?
- What withdrawal intent has been requested?
- What risk haircut applies?
- Is the liquidity position valid under policy?

## What liquidity-bond is NOT

- A live Omnia execution engine
- A custody or fund management system
- A yield or reward distribution system
- An LP share token issuer
- An AMM or order matching engine
- A transport/networking layer

## Relationship to provider-bond

`@totemsdk/provider-bond` scores providers. `@totemsdk/liquidity-bond` records productive liquidity supplied into pools/routes/positions associated with providers.

The relationship is one-way: liquidity-bond may reference `providerId`, `providerBondId` or `providerScore` via `ProviderBondRef`, but provider-bond must not depend on liquidity-bond.

## Relationship to Omnia

Liquidity-bond models the records and proofs required for Pool 001-style liquidity coordination, without executing the liquidity movement itself. Real channel/factory/splice execution belongs to `@totemsdk/omnia*` packages.

## Pool manifests

Pool manifests describe the pool/route/factory/RFQ reserve. They wrap `@totemsdk/manifest` `EdgeServiceManifest` and include pool type, purpose, asset, lock terms, fee policy, and risk policy.

## LP commitments

Commitments record an LP's intent to supply liquidity. They track the LP address, asset, amount, purpose, lock terms, and status (draft → signed → accepted/rejected/expired/cancelled).

## Liquidity positions

Positions record accepted liquidity. They track the LP, asset, amount, effective amount (after haircut), allocated/reserved/available amounts, and status (active → allocated → quiescing → withdrawn/depleted).

## Liquidity receipts

Receipts prove the LP's claim on a position. They are non-custodial claim records with deterministic hashes. No on-chain tokens are issued in v0.1.

## Allocations

Allocations record where liquidity is allocated or reserved (route-reserve, channel-capital, factory-capital, RFQ-inventory, settlement-reserve). Allocations must not exceed the position amount.

## Fee records as accounting records only

Fee records are attached accounting records. They track gross fees, LP fees, and operator fees by source (route-fee, RFQ-spread, merchant-fee, manual-adjustment, external-record). No automatic payment, yield promises, or reward emissions in v0.1.

## Withdrawal intents

Withdrawal intents record a request to withdraw liquidity. They enforce lock terms (early withdrawal penalties, unlock periods) but do not execute the actual withdrawal.

## Risk haircuts

Risk haircuts reduce the effective liquidity amount for risk-adjusted calculations. Double-counted liquidity detection prevents the same underlying UTXO or channel reference from being counted in multiple positions.

## Policy validation

Policies filter positions by: accepted assets, accepted purposes, minimum amount, maximum haircut, identity requirement, provider bond requirement, minimum provider score, and position status rules.

## MINIMA as default productive liquidity asset

- `MINIMA` is the default productive liquidity asset
- `MxUSD` may be accepted for stable settlement pools if policy allows it
- Other tokens must be explicitly accepted
- Expired/depleted/invalid positions fail policy checks

## Why v0.1 does not execute routing or settlement

v0.1 is a deterministic ledger/proof/receipt package, not a live liquidity engine. Real Omnia execution belongs to `@totemsdk/omnia*` packages.

## Why v0.1 does not promise yield

Fee records are accounting records only. They do not represent a promise of payment, yield, or return. No automatic fee distribution exists.

## Pear/Bare compatibility

The package is runtime-neutral. It avoids `node:crypto`, `fs`, `path`, `net`, `http`, `https`, `child_process`, DOM APIs, hidden `Date.now()`, hidden randomness, and side effects at module import time.

## Examples

### Create pool manifest

```ts
import { createLiquidityPoolManifest } from '@totemsdk/liquidity-bond';

const pool = createLiquidityPoolManifest({
  poolId: 'pool-001',
  poolType: 'omnia-router',
  purpose: 'omnia-router-liquidity',
  asset: 'MINIMA',
  lockTerms: { lockType: 'none' },
  totalCapacity: 1000000n,
});
```

### Create LP commitment

```ts
import { createLiquidityCommitment } from '@totemsdk/liquidity-bond';

const commitment = createLiquidityCommitment({
  poolId: 'pool-001',
  lpAddress: 'MxLP...',
  asset: 'MINIMA',
  amount: 100000n,
  purpose: 'omnia-router-liquidity',
  terms: { lockType: 'fixed-duration', unlockAfterMs: 86400000 },
});
```

### Accept commitment and create position

```ts
import { acceptLiquidityCommitment, createLiquidityPosition } from '@totemsdk/liquidity-bond';

const accepted = acceptLiquidityCommitment(commitment);
const position = createLiquidityPosition({ commitment: accepted, poolId: 'pool-001' });
```

### Issue receipt

```ts
import { issueLiquidityReceipt } from '@totemsdk/liquidity-bond';

const receipt = issueLiquidityReceipt({
  position, poolId: 'pool-001', ownerAddress: 'MxLP...',
});
```

### Allocate part of a position

```ts
import { createLiquidityAllocation } from '@totemsdk/liquidity-bond';

const allocation = createLiquidityAllocation({
  positionId: position.positionId,
  poolId: 'pool-001',
  amount: 50000n,
  purpose: 'omnia-router-liquidity',
  allocationType: 'route-reserve',
});
```

### Record fee accrual

```ts
import { recordLiquidityFee } from '@totemsdk/liquidity-bond';

const fee = recordLiquidityFee({
  positionId: position.positionId,
  poolId: 'pool-001',
  feeAsset: 'MINIMA',
  grossFeeAmount: 100n,
  lpFeeAmount: 80n,
  operatorFeeAmount: 20n,
  source: 'route-fee',
});
```

### Request withdrawal

```ts
import { createWithdrawalIntent, verifyWithdrawalAllowed } from '@totemsdk/liquidity-bond';

const intent = createWithdrawalIntent({
  positionId: position.positionId,
  poolId: 'pool-001',
  ownerAddress: 'MxLP...',
  amount: 50000n,
});

const result = verifyWithdrawalAllowed({ intent, position, pool });
```

### Validate policy

```ts
import { validateLiquidityAgainstPolicy } from '@totemsdk/liquidity-bond';

const result = validateLiquidityAgainstPolicy({
  position, pool,
  policy: { acceptedAssets: ['MINIMA'], minAmount: 1000n, rejectDepleted: true },
});
```

### Serialize state

```ts
import { serializeLiquidityBondState, parseLiquidityBondState } from '@totemsdk/liquidity-bond';

const json = serializeLiquidityBondState(state);
const restored = parseLiquidityBondState(json);
```

## Security and legal limitations

- v0.1 does not custody funds or manage private keys
- Fee records are accounting records only, not payment promises
- Receipts are non-custodial claim records, not transferable securities
- No yield, staking, or reward logic exists
- No automatic slashing or penalty execution
- No legal compliance or securities logic

## Future roadmap

- Live Omnia channel/factory integration
- LP share token issuance
- Automatic fee distribution
- Yield and reward mechanics
- DAO governance integration
- Transport layer for pool announcements and queries
- MxUSD stable settlement pool support
