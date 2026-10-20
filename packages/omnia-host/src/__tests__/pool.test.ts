/**
 * Omnia liquidity-pool host API — create, deposit, allocate, release,
 * withdraw, approve and payout.
 */

import os from 'node:os';
import { loadConfigFromEnv } from '../config.js';
import { createHostSigning } from '../signing.js';
import { createHostMethods, type HostApiContext } from '../api/methods.js';

const HEX_SEED = '0x' + 'ab'.repeat(32);
const dbPath = `${os.tmpdir()}/omnia-pool-${Date.now()}-${Math.random().toString(36).slice(2)}.sqlite`;

describe('pool host API', () => {
  it('runs the full liquidity lifecycle and roots the payout', async () => {
    const signing = createHostSigning(loadConfigFromEnv({ OMNIA_HOST_SEED: HEX_SEED, OMNIA_HOST_DB: dbPath }));
    const context = {
      channels: new Map(),
      pools: new Map(),
      poolPositions: new Map(),
      operations: {
        get: () => undefined,
        create: () => ({ operationId: 'op', status: 'pending' }),
        transition: () => ({ operationId: 'op', status: 'committed' }),
        listByStatus: () => [],
      },
      signer: signing.signer,
      leaseProvider: signing.leaseProvider,
      localParticipant: { partyId: 'operator', publicKeyDigest: signing.publicKeyDigest, addressIndex: 0 },
      chainProvider: {
        getCoin: jest.fn(async () => ({
          coinid: '0x' + '11'.repeat(32),
          amount: '100000',
          address: 'MxLP',
          tokenid: '0x00',
          spent: false,
        })),
      },
      custodyMode: 'self',
    } as unknown as HostApiContext;
    const methods = createHostMethods(context);

    await methods.get('omnia/createLiquidityPool')!({
      poolId: 'pool-1',
      operatorAddress: 'MxOPERATOR',
      tokenId: '0x00',
      purpose: 'omnia-channel-capital',
      poolType: 'community-pool',
      capacity: '1000000',
      feePolicy: { feeModel: 'pro-rata', lpFeeBps: 50, operatorFeeBps: 10 },
    });
    const deposited = await methods.get('omnia/depositToPool')!({
      poolId: 'pool-1',
      lpAddress: 'MxLP',
      amount: '100000',
      purpose: 'omnia-channel-capital',
      underlyingUtxoRef: '0x' + '11'.repeat(32),
    });
    const positionId = (deposited as any).position.positionId;
    expect(deposited).toMatchObject({ success: true });

    const allocated = await methods.get('omnia/allocatePoolCapital')!({
      positionId,
      amount: '50000',
      allocationType: 'manual-reserve',
      purpose: 'community-liquidity',
      target: { type: 'reserve', purpose: 'contingency' },
    });
    expect(allocated).toMatchObject({ success: true, position: { allocatedAmount: '50000' } });

    const released = await methods.get('omnia/releasePoolAllocation')!({ positionId });
    expect(released).toMatchObject({ success: true, position: { allocatedAmount: '0' } });

    await methods.get('omnia/withdrawPool')!({
      positionId,
      amount: '1000',
      recipientAddress: 'MxLP',
    });
    const approved = await methods.get('omnia/approvePoolWithdrawal')!({ positionId });
    expect(approved).toMatchObject({ success: true, intent: { status: 'approved' } });

    const paid = await methods.get('omnia/executePoolPayout')!({
      positionId,
      recipientAddress: 'MxLP',
      settlement: { status: 'confirmed', evidenceRef: 'indexer', txpowId: 'tx-pool' },
      signIndices: { addressIndex: 0, l1: 0, l2: 0 },
    });
    expect(paid).toMatchObject({ success: true, position: { amount: '99000' } });
    expect((paid as any).signedTransition).toBeDefined();
  });
});
