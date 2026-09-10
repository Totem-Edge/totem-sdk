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
- **Autonomous rebalance** — the vertical slice wiring run-level autonomy into the real wallet execution path: prepare → reduce → authorize → execute → commit/abort

## Autonomous rebalance

`executeAutonomousRebalanceStep` wires `@totemsdk/agent-policy`'s `GrantBoundAutonomyPolicy` into the real Omnia execution path. The wallet builds the Omnia transaction FIRST, reduces it to canonical security facts, authorizes exactly those effects, then executes and commits (or aborts on failure).

```typescript
import { executeAutonomousRebalanceStep } from '@totemsdk/omnia-pool';
import { GrantBoundAutonomyPolicy, MemoryRunStateStore } from '@totemsdk/agent-policy';
import { buildUpdateTx } from '@totemsdk/omnia';

const policy = new GrantBoundAutonomyPolicy({ /* profiles, mandateResolver, identityResolver */ });
await policy.openRun({ runId: 'run-1', agentId: 'ag', principal: 'MxFleet', grantProofIds: ['proof:owner-grant'], profileId: 'channel-rebalance' });

// 1. The wallet builds the channel update tx FIRST.
const draft = buildUpdateTx(channel, 1, { alice: 700n, bob: 300n }, []);

// 2. Execute the governed step: prepare → reduce → authorize → execute → commit/abort.
const result = await executeAutonomousRebalanceStep(
  { policy, runId: 'run-1', principal: 'MxFleet', agentId: 'ag', ctx: { omnia: port } },
  {
    stepId: 'pay-1',
    action: 'pay',
    nonce: 'pay-1',
    draft,
    channelUpdate: { channel, newBalances: { alice: 700n, bob: 300n }, operation: 'state_update' },
    simulation: { ok: true },
  },
);

if (result.outcome === 'approved') {
  // result.txDigest is the execution proof bound to the exact authorized tx.
  const graph = await policy.getRunReceiptGraph('run-1');
}
```

Key correctness property: only outputs that leave the channel's own script are counted as spends. A channel-internal rebalance (update tx paying the full value back to the channel script) is a state change, not an external spend.

## Usage

### Create a pool and deposit

```typescript
import { createOmniaPool, depositToPool } from '@totemsdk/omnia-pool';
import { createEmptyLiquidityBondRegistryState } from '@totemsdk/liquidity-bond';

const registry = createEmptyLiquidityBondRegistryState();
const { manifest, registry: reg } = createOmniaPool({
  poolId: 'pool-1',
  operatorAddress: 'MxOPERATOR',
  tokenId: '0x00',
  purpose: 'omnia-channel-capital',
  poolType: 'community-pool',
  capacity: '1000000',
  feePolicy: { feeModel: 'pro-rata', lpFeeBps: 50, operatorFeeBps: 10 },
}, registry);

const { position, state } = await depositToPool({
  pool: manifest,
  lpAddress: 'MxLP',
  amount: '100000',
  purpose: 'omnia-channel-capital',
  underlyingUtxoRef: '0xFUND1',
  chainProvider, // verifies the funding coin on-chain
}, reg);

console.log('LP position:', position.positionId);
```

### Allocate and rebalance capital

```typescript
import { allocatePositionCapital, rebalancePoolCapital } from '@totemsdk/omnia-pool';

const { allocation } = await allocatePositionCapital({
  position,
  amount: '50000',
  allocationType: 'manual-reserve',
  purpose: 'community-liquidity',
  target: { type: 'reserve', purpose: 'old' },
}, state);

const result = await rebalancePoolCapital({
  from: allocation,
  toTarget: { type: 'reserve', purpose: 'new' },
  amount: '30000',
}, position, state);
// result.released.status === 'released'; result.newAllocation.amount === 30000n
```

### Fees and withdrawal

```typescript
import { recordPoolFee, claimFees, withdrawLiquidity, approveWithdrawal, executePoolPayout } from '@totemsdk/omnia-pool';

const { feeRecord } = recordPoolFee(
  { pool: manifest, position, grossAmount: '10000', source: 'route-fee', earnProof: { htlcId: 'h-1' }, verified: true },
  state,
);

const payoutRef = { payoutId: 'p-1', nonce: 'n1', kind: 'vtxo-mint' as const };
const claimed = claimFees(manifest, position, feeReg, {
  positionId: position.positionId,
  amount: '20',
  payoutRef,
});

const intent = withdrawLiquidity({ positionId: position.positionId, amount: '100', recipientAddress: 'MxLP' }, state);
approveWithdrawal({ intent, signer });
await executePoolPayout({ pool: manifest, position, intent, recipientAddress: 'MxLP' }, state);
```

## Dependencies

Runtime deps: `agent-policy`, `chain-provider`, `liquidity-bond`, `tx-builder`, `wots-lease`.

Optional peer execution ports: `omnia`, `omnia-factory`, `omnia-router`, `omnia-splice`, `omnia-vtxo`.

## License

MIT — see [LICENSE](./LICENSE).