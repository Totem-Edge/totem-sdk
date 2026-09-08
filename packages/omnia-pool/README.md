# @totemsdk/omnia-pool

**Generic Omnia liquidity pool orchestration primitive.**

Sits between [`@totemsdk/liquidity-bond`](../liquidity-bond) (deterministic LP accounting) and the live Omnia execution family — [`omnia`](../omnia), [`omnia-factory`](../omnia-factory), [`omnia-router`](../omnia-router), [`omnia-splice`](../omnia-splice), [`omnia-vtxo`](../omnia-vtxo) — to deploy, allocate, and withdraw pooled capital.

## Install

```bash
npm install @totemsdk/omnia-pool
```

## What's inside

- **Pool deployment** — create an Omnia liquidity pool, deployable against factory, router, splice, vtxo, or raw Omnia execution ports
- **Deposits** — commit liquidity, accept commitments, mint LP position receipts, and register deposits against the `liquidity-bond` ledger
- **Allocation** — allocate pooled capital to a chosen execution target (reserve, channel, factory, router, vtxo), release allocations, rebalance across targets, and quiesce a position
- **Fees** — record pool fees, compute unclaimed fee balances, claim and compound LP fees, and report pool utilisation
- **NAV & risk** — compute pool NAV (`position + fees − pending`) and a heuristic utilisation-based risk score
- **Withdrawals** — withdraw liquidity, approve withdrawals, and execute the resulting on-chain payout (rejected unless approved)

## Usage

### Create a pool and deposit

```typescript
import { createOmniaPool, depositToPool } from '@totemsdk/omnia-pool';

const pool = createOmniaPool({
  id: 'pool-1',
  managerSigner: signer,        // PoolSigner
  provider,                     // ChainStateProvider
  reserveAmount: '1000',
  tokenid: '0x00',
});

const committed = depositToPool({
  poolId: pool.id,
  depositorAddress: 'MxAAA...',
  amount: '250',
  signer,
  provider,
  leaseProvider,
});

console.log('LP receipt:', committed.receipt);
```

### Allocate and rebalance capital

```typescript
import { allocatePositionCapital, rebalancePoolCapital } from '@totemsdk/omnia-pool';

await allocatePositionCapital({
  pool,
  target: { type: 'factory', factoryId: 'fx-1', amount: '500' },
});

await rebalancePoolCapital({
  pool,
  from: { type: 'reserve', amount: '250' },
  to: { type: 'router', routerId: 'rt-1', amount: '250' },
});
```

### Fees and withdrawal

```typescript
import { recordPoolFee, claimFees, withdrawLiquidity, approveWithdrawal, executePoolPayout } from '@totemsdk/omnia-pool';

recordPoolFee({ pool, source: 'merchant-fee', amount: '10', payer: 'MxPAYER' });

const claimable = computeUnclaimedFees(pool, 'MxLP');
await claimFees({ pool, recipient: 'MxLP', amount: '5' });

const intent = withdrawLiquidity({ pool, lpAddress: 'MxLP', amount: '100' });
approveWithdrawal({ pool, intentId: intent.id, signer });
await executePoolPayout({ pool, intent });
```

## Dependencies

Runtime deps: `chain-provider`, `liquidity-bond`, `tx-builder`, `wots-lease`.

Optional peer execution ports: `omnia`, `omnia-factory`, `omnia-router`, `omnia-splice`, `omnia-vtxo`.

## License

MIT — see [LICENSE](./LICENSE).