/**
 * omnia-pool/__tests__/pool.test.ts — Core lifecycle and allocation tests.
 */

import {
  createEmptyLiquidityBondRegistryState,
  computeRegistryRoot,
  type LiquidityBondRegistryState,
  type RegistryTransitionSigner,
} from '@totemsdk/liquidity-bond';
import {
  createOmniaPool,
  depositToPool,
  allocatePositionCapital,
  releaseAllocation,
  rebalancePoolCapital,
  recordPoolFee,
  claimFees,
  compoundFees,
  computePoolNAV,
  computePoolRiskScore,
  withdrawLiquidity,
  approveWithdrawal,
  executePoolPayout,
  getUtilisation,
  toOmniaPoolFeeRecord,
  type CreateOmniaPoolParams,
  type OmniaExecutionPort,
  type FactoryExecutionPort,
  type RouterExecutionPort,
  type VtxoExecutionPort,
} from '../index.js';

describe('omnia-pool', () => {
  const tokenId = '0x00';
  const operator = 'MxOPERATOR';
  const lp = 'MxLP';
  let registry: LiquidityBondRegistryState;

  const passFundingVerifier = {
    verifyDeposit: jest.fn(async () => ({ valid: true })),
  };

  let fundingCoinSeq = 0;

  async function makeDeposit(
    params: Parameters<typeof depositToPool>[0],
    reg: Parameters<typeof depositToPool>[1],
  ) {
    fundingCoinSeq++;
    return depositToPool(
      { ...params, underlyingUtxoRef: params.underlyingUtxoRef ?? `0xFUND${fundingCoinSeq}`, chainProvider: passFundingVerifier },
      reg,
    );
  }

  beforeEach(() => {
    registry = createEmptyLiquidityBondRegistryState();
  });

  function basePoolParams(): CreateOmniaPoolParams {
    return {
      poolId: 'pool-1',
      operatorAddress: operator,
      tokenId,
      purpose: 'omnia-channel-capital',
      poolType: 'community-pool',
      capacity: '1000000',
      feePolicy: { feeModel: 'pro-rata', lpFeeBps: 50, operatorFeeBps: 10 },
    };
  }

  it('creates and loads a pool', () => {
    const pool = createOmniaPool(basePoolParams(), registry);
    expect(pool.poolId).toBe('pool-1');
    expect(pool.manifest.asset).toBe(tokenId);
    expect(pool.registry.pools['pool-1']).toBeDefined();

    const loaded = createOmniaPool(basePoolParams(), registry);
    expect(loaded.manifest.poolId).toBe('pool-1');
  });

  it('deposits liquidity and issues a receipt', async () => {
    const { manifest } = createOmniaPool(basePoolParams(), registry);
    const result = await makeDeposit(
      {
        pool: manifest,
        lpAddress: lp,
        amount: '100000',
        purpose: 'omnia-channel-capital',
      },
      registry,
    );
    expect(result.position.amount).toBe(100000n);
    expect(result.position.poolId).toBe('pool-1');
    expect(result.receipt.ownerAddress).toBe(lp);
    expect(result.state.positions[result.position.positionId]).toBeDefined();
  });

  it('refuses a deposit whose funding fails on-chain verification', async () => {
    const { manifest } = createOmniaPool(basePoolParams(), registry);
    await expect(
      depositToPool(
        {
          pool: manifest,
          lpAddress: lp,
          amount: '100000',
          purpose: 'omnia-channel-capital',
          underlyingUtxoRef: '0xC1',
          chainProvider: { verifyDeposit: async () => ({ valid: false, reason: 'coin is spent' }) },
        },
        registry,
      ),
    ).rejects.toThrow(/funding failed on-chain confirmation|not acceptable/);
  });

  it('requires a chainProvider to accept a deposit', async () => {
    const { manifest } = createOmniaPool(basePoolParams(), registry);
    await expect(
      depositToPool({ pool: manifest, lpAddress: lp, amount: '100000', purpose: 'omnia-channel-capital' }, registry),
    ).rejects.toThrow(/chainProvider/);
  });

  it('allocates to a reserve target without a port', async () => {
    const { manifest, registry: reg } = createOmniaPool(basePoolParams(), registry);
    const { position, state } = await makeDeposit(
      { pool: manifest, lpAddress: lp, amount: '100000', purpose: 'omnia-channel-capital' },
      reg,
    );
    const result = await allocatePositionCapital(
      {
        position,
        amount: '50000',
        allocationType: 'manual-reserve',
        purpose: 'community-liquidity',
        target: { type: 'reserve', purpose: 'contingency' },
      },
      state,
    );
    expect(result.position.allocatedAmount).toBe(50000n);
    expect(result.position.availableAmount).toBe(50000n);
    expect(result.allocation.amount).toBe(50000n);
  });

  it('allocates to an omnia channel target using a port', async () => {
    const channel = { channelId: 'ch-1', status: 'opening' } as unknown as import('@totemsdk/omnia').OmniaChannel;
    const port: OmniaExecutionPort = {
      createChannel: jest.fn().mockResolvedValue(channel),
      updateState: jest.fn(),
      addHTLC: jest.fn(),
      fulfillHTLC: jest.fn(),
      proposeSettlement: jest.fn(),
      verifyStateForCoSign: jest.fn().mockResolvedValue({ valid: true, errors: [] }),
      closeChannel: jest.fn().mockResolvedValue({ channel, settlementPayload: {} }),
    };

    const { manifest, registry: reg } = createOmniaPool(basePoolParams(), registry);
    const { position, state } = await makeDeposit(
      { pool: manifest, lpAddress: lp, amount: '100000', purpose: 'omnia-channel-capital' },
      reg,
    );

    const result = await allocatePositionCapital(
      {
        position,
        amount: '40000',
        allocationType: 'channel-capital',
        purpose: 'omnia-channel-capital',
        target: { type: 'channel', params: {} as never },
        ctx: { omnia: port },
      },
      state,
    );

    expect(port.createChannel).toHaveBeenCalled();
    expect(result.execution).toBe(channel);
    expect(result.position.allocatedAmount).toBe(40000n);
  });

  it('allocates to a factory target using a port', async () => {
    const factory = { factoryId: 'f-1', status: 'opening' } as unknown as import('@totemsdk/omnia-factory').ChannelFactory;
    const port: FactoryExecutionPort = {
      createFactory: jest.fn().mockResolvedValue(factory),
      reallocate: jest.fn(),
      openVirtualChannel: jest.fn(),
      closeVirtualChannel: jest.fn(),
      closeFactory: jest.fn(),
    };

    const { manifest, registry: reg } = createOmniaPool(basePoolParams(), registry);
    const { position, state } = await makeDeposit(
      { pool: manifest, lpAddress: lp, amount: '100000', purpose: 'omnia-factory-capital' },
      reg,
    );

    const result = await allocatePositionCapital(
      {
        position,
        amount: '30000',
        allocationType: 'factory-capital',
        purpose: 'omnia-factory-capital',
        target: { type: 'factory', params: { participants: [], tokenId, bundle: {} as never } },
        ctx: { factory: port },
      },
      state,
    );

    expect(port.createFactory).toHaveBeenCalled();
    expect(result.execution).toBe(factory);
  });

  it('allocates to a router target using a port', async () => {
    const graph = { channels: new Map() } as unknown as import('@totemsdk/omnia-router').ChannelGraph;
    const port: RouterExecutionPort = {
      createChannelGraph: jest.fn().mockReturnValue(graph),
      addChannel: jest.fn().mockReturnValue(graph),
      findRoute: jest.fn(),
      executeMultiHopPayment: jest.fn(),
    };

    const { manifest, registry: reg } = createOmniaPool(basePoolParams(), registry);
    const { position, state } = await makeDeposit(
      { pool: manifest, lpAddress: lp, amount: '100000', purpose: 'omnia-router-liquidity' },
      reg,
    );

    const channel = { channelId: 'rc-1' } as unknown as import('@totemsdk/omnia-router').RouterChannel;
    const result = await allocatePositionCapital(
      {
        position,
        amount: '20000',
        allocationType: 'route-reserve',
        purpose: 'omnia-router-liquidity',
        target: { type: 'router', channel },
        ctx: { router: port },
      },
      state,
    );

    expect(port.createChannelGraph).toHaveBeenCalled();
    expect(port.addChannel).toHaveBeenCalledWith(graph, channel);
    expect(result.execution).toBe(graph);
  });

  it('allocates to a vtxo target using a port', async () => {
    const vtxo = { vtxoId: 'v-1' } as unknown as import('@totemsdk/omnia-vtxo').OmniaVtxo;
    const pool = { poolId: 'vtxo-pool-1' } as unknown as import('@totemsdk/omnia-vtxo').OmniaVtxoPool;
    const port: VtxoExecutionPort = {
      createPool: jest.fn(),
      mintVtxo: jest.fn().mockResolvedValue({ pool, vtxo }),
      createExitDraft: jest.fn(),
      markExiting: jest.fn(),
      markExited: jest.fn(),
    };

    const { manifest, registry: reg } = createOmniaPool(basePoolParams(), registry);
    const { position, state } = await makeDeposit(
      { pool: manifest, lpAddress: lp, amount: '100000', purpose: 'statechain-exit-reserve' },
      reg,
    );

    const result = await allocatePositionCapital(
      {
        position,
        amount: '25000',
        allocationType: 'settlement-reserve',
        purpose: 'statechain-exit-reserve',
        target: { type: 'vtxo', pool, params: { owner: lp, amount: 25000n, nonce: 'n1' } },
        ctx: { vtxo: port },
      },
      state,
    );

    expect(port.mintVtxo).toHaveBeenCalledWith(pool, expect.objectContaining({ owner: lp, amount: 25000n }));
    expect(result.execution).toEqual({ pool, vtxo });
  });

  it('returns a signed registry transition when rooting is provided', async () => {
    const signer: RegistryTransitionSigner = {
      publicKeyDigest: 'rooter-1',
      sign: jest.fn().mockResolvedValue(new Uint8Array([7, 8, 9])),
    };
    const { manifest, registry: reg } = createOmniaPool(basePoolParams(), registry);
    const { position, state } = await makeDeposit(
      { pool: manifest, lpAddress: lp, amount: '100000', purpose: 'omnia-channel-capital' },
      reg,
    );

    const result = await allocatePositionCapital(
      {
        position,
        amount: '40000',
        allocationType: 'channel-capital',
        purpose: 'omnia-channel-capital',
        target: { type: 'reserve', purpose: 'co-sign' },
        rooting: { signer, previousRoot: undefined, reason: 'channel-capital commitment' },
      },
      state,
    );

    expect(signer.sign).toHaveBeenCalled();
    expect(result.signedTransition).toBeDefined();
    expect(result.signedTransition!.signerPublicKey).toBe('rooter-1');
    expect(result.signedTransition!.delta.op.type).toBe('allocate');
    expect(result.signedTransition!.delta.root).toBe(computeRegistryRoot(result.registry));
  });

  it('re-pays a rooted allocation through a co-signed payout', async () => {
    const signer: RegistryTransitionSigner = {
      publicKeyDigest: 'rooter-1',
      sign: jest.fn().mockResolvedValue(new Uint8Array([7, 8, 9])),
    };
    const { manifest, registry: reg } = createOmniaPool(basePoolParams(), registry);
    const { position, state } = await makeDeposit(
      { pool: manifest, lpAddress: lp, amount: '100000', purpose: 'omnia-channel-capital' },
      reg,
    );

    const { intent, state: withIntent } = withdrawLiquidity(
      manifest,
      position,
      { positionId: position.positionId, amount: '1000', recipientAddress: lp },
      state,
    );
    const { intent: approved, registry: approvedReg } = approveWithdrawal(intent, position, withIntent);
    const result = await executePoolPayout(
      { pool: manifest, position, intent: approved, recipientAddress: lp, rooting: { signer } },
      approvedReg,
    );

    expect(result.signedTransition).toBeDefined();
    expect(result.signedTransition!.delta.op.type).toBe('payout');
    expect(result.signedTransition!.delta.op.withdrawalId).toBe(intent.withdrawalId);
    expect(result.signedTransition!.delta.root).toBe(computeRegistryRoot(result.registry));
  });

  it('rejects allocation type/purpose mismatch', async () => {
    const { manifest, registry: reg } = createOmniaPool(basePoolParams(), registry);
    const { position, state } = await makeDeposit(
      { pool: manifest, lpAddress: lp, amount: '100000', purpose: 'omnia-channel-capital' },
      reg,
    );

    await expect(
      allocatePositionCapital(
        {
          position,
          amount: '1000',
          allocationType: 'route-reserve',
          purpose: 'omnia-channel-capital',
          target: { type: 'reserve', purpose: 'bad' },
        },
        state,
      ),
    ).rejects.toThrow('does not match purpose');
  });

  it('releases an allocation and restores availability', async () => {
    const { manifest, registry: reg } = createOmniaPool(basePoolParams(), registry);
    const { position, state } = await makeDeposit(
      { pool: manifest, lpAddress: lp, amount: '100000', purpose: 'omnia-channel-capital' },
      reg,
    );
    const { allocation, position: allocPos, registry: allocReg } = await allocatePositionCapital(
      {
        position,
        amount: '60000',
        allocationType: 'channel-capital',
        purpose: 'omnia-channel-capital',
        target: { type: 'reserve', purpose: 'hold' },
      },
      state,
    );

    const result = releaseAllocation({ allocation, position: allocPos }, allocReg);
    expect(result.position.allocatedAmount).toBe(0n);
    expect(result.position.availableAmount).toBe(100000n);
    expect(result.allocation.status).toBe('released');
  });

  it('rebalances capital between targets', async () => {
    const { manifest, registry: reg } = createOmniaPool(basePoolParams(), registry);
    const { position, state } = await makeDeposit(
      { pool: manifest, lpAddress: lp, amount: '100000', purpose: 'community-liquidity' },
      reg,
    );
    const { allocation } = await allocatePositionCapital(
      {
        position,
        amount: '50000',
        allocationType: 'manual-reserve',
        purpose: 'community-liquidity',
        target: { type: 'reserve', purpose: 'old' },
      },
      state,
    );

    const result = await rebalancePoolCapital(
      {
        from: allocation,
        toTarget: { type: 'reserve', purpose: 'new' },
        amount: '30000',
      },
      position,
      state,
    );

    expect(result.released.status).toBe('released');
    expect(result.newAllocation.amount).toBe(30000n);
    expect(result.newAllocation.purpose).toBe('community-liquidity');
    expect(result.position.availableAmount).toBe(70000n);
  });

  it('rebalances capital to a vtxo target as vtxo-backing', async () => {
    const vtxoPool = { poolId: 'vtxo-pool-2' } as unknown as import('@totemsdk/omnia-vtxo').OmniaVtxoPool;
    const port: VtxoExecutionPort = {
      createPool: jest.fn(),
      mintVtxo: jest.fn().mockResolvedValue({ pool: vtxoPool, vtxo: { vtxoId: 'v-2' } }),
      createExitDraft: jest.fn(),
      markExiting: jest.fn(),
      markExited: jest.fn(),
    };

    const { manifest, registry: reg } = createOmniaPool(basePoolParams(), registry);
    const { position, state } = await makeDeposit(
      { pool: manifest, lpAddress: lp, amount: '100000', purpose: 'community-liquidity' },
      reg,
    );
    const { allocation, registry: allocReg } = await allocatePositionCapital(
      {
        position,
        amount: '50000',
        allocationType: 'manual-reserve',
        purpose: 'community-liquidity',
        target: { type: 'reserve', purpose: 'old' },
      },
      state,
    );

    const result = await rebalancePoolCapital(
      {
        from: allocation,
        toTarget: { type: 'vtxo', pool: vtxoPool, params: { owner: lp, amount: 25000n, nonce: 'n2' } },
        amount: '30000',
        ctx: { vtxo: port },
      },
      position,
      allocReg,
    );

    expect(result.released.status).toBe('released');
    expect(result.newAllocation.allocationType).toBe('vtxo-backing');
    expect(result.newAllocation.purpose).toBe('vtxo-pool-backing');
    expect(port.mintVtxo).toHaveBeenCalled();
    expect(result.newAllocation.amount).toBe(30000n);
  });

  it('records, claims and compounds fees', async () => {
    const params = basePoolParams();
    const { manifest, registry: reg } = createOmniaPool(params, registry);
    const { position, state } = await makeDeposit(
      { pool: manifest, lpAddress: lp, amount: '100000', purpose: 'omnia-channel-capital' },
      reg,
    );

    const { feeRecord, registry: feeReg } = recordPoolFee(
      { pool: manifest, position, grossAmount: '10000', source: 'route-fee' },
      state,
    );
    expect(feeRecord.grossFeeAmount).toBe(10000n);
    expect(feeRecord.lpFeeAmount).toBe(50n);
    expect(feeRecord.operatorFeeAmount).toBe(10n);

    const view = toOmniaPoolFeeRecord(feeRecord);
    expect(view.amount).toBe('10000');
    expect(view.positionId).toBe(position.positionId);

    const claimed = claimFees(manifest, position, feeReg, { positionId: position.positionId, amount: '20' });
    expect(claimed.claimedAmount).toBe(20n);

    const compounded = compoundFees(manifest, position, claimed.registry);
    expect(compounded.compoundedAmount).toBe(30n);
    expect(compounded.position.amount).toBe(100030n);
  });

  it('computes pool NAV and risk score', async () => {
    const { manifest, registry: reg } = createOmniaPool(basePoolParams(), registry);
    const { position, state } = await makeDeposit(
      { pool: manifest, lpAddress: lp, amount: '100000', purpose: 'omnia-channel-capital' },
      reg,
    );
    const { registry: afterFee } = recordPoolFee(
      { pool: manifest, position, grossAmount: '20000', source: 'route-fee' },
      state,
    );

    const nav = computePoolNAV(manifest, afterFee);
    expect(nav.totalCommitted).toBe(100000n);
    expect(nav.accruedFees).toBe(100n);
    expect(nav.nav).toBe(100100n);

    const filtered = computePoolNAV(manifest, afterFee, (p) => p.positionId !== position.positionId);
    expect(filtered.totalCommitted).toBe(0n);
    expect(filtered.nav).toBe(0n);

    const risk = computePoolRiskScore(manifest, afterFee);
    expect(typeof risk).toBe('number');
    expect(risk).toBeGreaterThanOrEqual(0);
    expect(risk).toBeLessThanOrEqual(100);

    const util = getUtilisation(manifest, afterFee);
    expect(typeof util).toBe('number');
  });

  it('withdraws liquidity and executes payout', async () => {
    const { manifest, registry: reg } = createOmniaPool(basePoolParams(), registry);
    const { position, state } = await makeDeposit(
      { pool: manifest, lpAddress: lp, amount: '100000', purpose: 'omnia-channel-capital' },
      reg,
    );

    const { intent, state: withIntent } = withdrawLiquidity(
      manifest,
      position,
      { positionId: position.positionId, amount: '30000', recipientAddress: lp },
      state,
    );
    expect(intent.status).toBe('requested');

    const { intent: approved, registry: approvedReg } = approveWithdrawal(intent, position, withIntent);
    expect(approved.status).toBe('approved');

    const result = await executePoolPayout(
      { pool: manifest, position, intent: approved, recipientAddress: lp },
      approvedReg,
    );
    expect(result.intent.status).toBe('settled-externally');
    expect(result.position.amount).toBe(70000n);
    expect(result.position.availableAmount).toBe(70000n);
  });

  it('payouts a channel-backed position via ctx.loadChannel', async () => {
    const channel = { channelId: 'ch-9', status: 'open' } as unknown as import('@totemsdk/omnia').OmniaChannel;
    const port: OmniaExecutionPort = {
      createChannel: jest.fn(),
      updateState: jest.fn(),
      addHTLC: jest.fn(),
      fulfillHTLC: jest.fn(),
      proposeSettlement: jest.fn().mockResolvedValue({ settlementId: 's-1' }),
      verifyStateForCoSign: jest.fn().mockResolvedValue({ valid: true, errors: [] }),
      closeChannel: jest.fn(),
    };
    const loadChannel = jest.fn().mockResolvedValue(channel);
    const saveChannelSnapshot = jest.fn();

    const { manifest, registry: reg } = createOmniaPool(basePoolParams(), registry);
    const { position, state } = await makeDeposit(
      {
        pool: manifest,
        lpAddress: lp,
        amount: '100000',
        purpose: 'omnia-channel-capital',
        underlyingRefs: { omniaChannelId: 'ch-9' },
      },
      reg,
    );

    const { intent, state: withIntent } = withdrawLiquidity(
      manifest,
      position,
      { positionId: position.positionId, amount: '20000', recipientAddress: lp },
      state,
    );
    const { intent: approved, registry: approvedReg } = approveWithdrawal(intent, position, withIntent);

    const result = await executePoolPayout(
      {
        pool: manifest,
        position,
        intent: approved,
        recipientAddress: lp,
        ctx: { omnia: port, loadChannel, saveChannelSnapshot },
      },
      approvedReg,
    );

    expect(loadChannel).toHaveBeenCalledWith('ch-9');
    expect(port.proposeSettlement).toHaveBeenCalledWith(channel);
    expect(saveChannelSnapshot).toHaveBeenCalledWith(channel);
    expect(result.intent.status).toBe('settled-externally');
    expect(result.position.status).toBe('active');
    expect(result.position.amount).toBe(80000n);
  });

  it('refuses to payout an unapproved intent', async () => {
    const { manifest, registry: reg } = createOmniaPool(basePoolParams(), registry);
    const { position, state } = await makeDeposit(
      { pool: manifest, lpAddress: lp, amount: '100000', purpose: 'omnia-channel-capital' },
      reg,
    );

    const { intent, state: withIntent } = withdrawLiquidity(
      manifest,
      position,
      { positionId: position.positionId, amount: '10000', recipientAddress: lp },
      state,
    );

    await expect(
      executePoolPayout({ pool: manifest, position, intent, recipientAddress: lp }, withIntent),
    ).rejects.toThrow('must be approved before payout');
  });
});
