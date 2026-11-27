/**
 * omnia-pool/__tests__/pool.test.ts — Core lifecycle and allocation tests.
 */

import {
  createEmptyLiquidityBondRegistryState,
  createLiquidityCommitment,
  computeRegistryRoot,
  registerSettledFeePayout,
  type LiquidityBondRegistryState,
  type RegistryTransitionSigner,
  issueLiquidityReceipt,
} from '@totemsdk/liquidity-bond';
import {
  createOmniaPool,
  depositToPool,
  createPositionFromCommitment,
  allocatePositionCapital,
  releaseAllocation,
  confirmAllocationRecovery,
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

  const passFeeProofVerifier = {
    verifyFeeProof: jest.fn(async () => ({ valid: true })),
  };

  const passSettlementVerifier = {
    verifySettlement: jest.fn(async () => ({ valid: true })),
  };

  /** Build finality evidence bound to the exact payout it settles. */
  function settlementFor(
    manifest: { poolId: string },
    position: { positionId: string },
    intent: { withdrawalId: string; amount: bigint },
    recipientAddress: string,
    overrides: Record<string, unknown> = {},
  ) {
    return {
      status: 'confirmed' as const,
      evidenceRef: 'idx-1',
      txpowId: 'tx-1',
      withdrawalId: intent.withdrawalId,
      poolId: manifest.poolId,
      positionId: position.positionId,
      recipientAddress,
      amount: intent.amount.toString(),
      ...overrides,
    };
  }

  /** Register a verified settled payout so a claim/compound can consume it. */
  function registerPayout(
    reg: LiquidityBondRegistryState,
    params: {
      payoutRef: { payoutId: string; nonce: string; kind: 'vtxo-mint' | 'channel-settlement' | 'external' };
      positionId: string;
      amount: bigint;
    },
  ) {
    return registerSettledFeePayout(reg, {
      ...params,
      poolId: 'pool-1',
      settlement: { status: 'confirmed', evidenceRef: `ev-${params.payoutRef.payoutId}`, txpowId: 'tx-fee' },
      verifier: passSettlementVerifier,
    });
  }

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

  it('OMN-111: one accepted commitment backs exactly one position', () => {
    const { manifest } = createOmniaPool(basePoolParams(), registry);
    const commitment = createLiquidityCommitment({
      poolId: 'pool-1',
      lpAddress: lp,
      asset: manifest.asset,
      amount: 100000n,
      purpose: 'omnia-channel-capital',
      terms: manifest.lockTerms,
      funding: { utxoRef: '0xFUND-OMN111', tokenId, amount: 100000n, status: 'chain-confirmed' },
    });

    const first = createPositionFromCommitment(commitment, manifest, registry);
    const retry = createPositionFromCommitment(commitment, manifest, first.registry);

    expect(retry.position.positionId).toBe(first.position.positionId);
    expect(Object.values(retry.registry.positions)).toHaveLength(1);
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
        target: { type: 'channel', params: { localAmount: 20000n, remoteAmount: 20000n } as never },
        ctx: { omnia: port },
      },
      state,
    );

    expect(port.createChannel).toHaveBeenCalled();
    expect(result.execution).toBe(channel);
    expect(result.position.allocatedAmount).toBe(40000n);
  });

  it('refuses a channel allocation whose state fails co-sign verification', async () => {
    const channel = {
      channelId: 'ch-2',
      status: 'opening',
      latestState: { sequence: 1 },
    } as unknown as import('@totemsdk/omnia').OmniaChannel;
    const port: OmniaExecutionPort = {
      createChannel: jest.fn().mockResolvedValue(channel),
      updateState: jest.fn(),
      addHTLC: jest.fn(),
      fulfillHTLC: jest.fn(),
      proposeSettlement: jest.fn(),
      verifyStateForCoSign: jest.fn().mockResolvedValue({ valid: false, errors: ['balance conservation failed'] }),
      closeChannel: jest.fn(),
    };

    const { manifest, registry: reg } = createOmniaPool(basePoolParams(), registry);
    const { position, state } = await makeDeposit(
      { pool: manifest, lpAddress: lp, amount: '100000', purpose: 'omnia-channel-capital' },
      reg,
    );

    await expect(
      allocatePositionCapital(
        {
          position,
          amount: '40000',
          allocationType: 'channel-capital',
          purpose: 'omnia-channel-capital',
          target: { type: 'channel', params: { localAmount: 20000n, remoteAmount: 20000n } as never },
          ctx: { omnia: port },
        },
        state,
      ),
    ).rejects.toThrow(/co-sign verification failed/);
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
        target: { type: 'factory', params: { participants: [], tokenId, bundle: {} as never, totalAmount: 30000n } },
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

    const channel = {
      channelId: 'rc-1',
      from: 'a',
      to: 'b',
      tokenId: '0x00',
      availableBalance: 100000n,
      htlcCapacity: 100000n,
      feeRate: 0n,
    } as unknown as import('@totemsdk/omnia-router').ChannelGraphEdge;
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
    const vtxo = { vtxoId: 'v-1' } as unknown as import('@totemsdk/vtxo').OmniaVtxo;
    const pool = { poolId: 'vtxo-pool-1' } as unknown as import('@totemsdk/vtxo').OmniaVtxoPool;
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
      sign: jest.fn(async () => new Uint8Array([7, 8, 9])),
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
        rooting: { signer, signIndices: { addressIndex: 0, l1: 0, l2: 0 }, previousRoot: undefined, reason: 'channel-capital commitment' },
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
      sign: jest.fn(async () => new Uint8Array([7, 8, 9])),
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
      {
        pool: manifest,
        position,
        intent: approved,
        recipientAddress: lp,
        settlement: settlementFor(manifest, position, approved, lp),
        settlementVerifier: passSettlementVerifier,
        rooting: { signer, signIndices: { addressIndex: 0, l1: 0, l2: 1 } },
      },
      approvedReg,
    );

    expect(result.signedTransition).toBeDefined();
    expect(result.signedTransition!.delta.op.type).toBe('payout');
    expect(result.signedTransition!.delta.op.withdrawalId).toBe(intent.withdrawalId);
    expect(result.signedTransition!.delta.root).toBe(computeRegistryRoot(result.registry));
  });

  it('does not settle or decrement capital without finality evidence (RFC-048 §3.3)', async () => {
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

    // No `settlement` → the payout is only a draft: position and intent unchanged.
    const result = await executePoolPayout(
      { pool: manifest, position, intent: approved, recipientAddress: lp },
      approvedReg,
    );
    expect(result.intent.status).toBe('approved');
    expect(result.position.amount).toBe(position.amount);
    expect(result.signedTransition).toBeUndefined();
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

    const result = releaseAllocation({
      allocation,
      position: allocPos,
      recovery: { evidenceRef: 'channel-close-tx', recoveredAmount: 60000n, verified: true },
    }, allocReg);
    expect(result.position.allocatedAmount).toBe(0n);
    expect(result.position.availableAmount).toBe(100000n);
    expect(result.allocation.status).toBe('released');
  });

  it('OMN-112: refuses an allocation beyond risk-adjusted headroom before executing', async () => {
    const { manifest, registry: reg } = createOmniaPool(basePoolParams(), registry);
    const { position, state } = await makeDeposit(
      { pool: manifest, lpAddress: lp, amount: '100000', purpose: 'omnia-channel-capital' },
      reg,
    );
    const first = await allocatePositionCapital(
      {
        position,
        amount: '60000',
        allocationType: 'manual-reserve',
        purpose: 'community-liquidity',
        target: { type: 'reserve', purpose: 'hold' },
      },
      state,
    );
    const port: OmniaExecutionPort = {
      createChannel: jest.fn(),
      updateState: jest.fn(),
      addHTLC: jest.fn(),
      fulfillHTLC: jest.fn(),
      proposeSettlement: jest.fn(),
      verifyStateForCoSign: jest.fn().mockResolvedValue({ valid: true, errors: [] }),
      closeChannel: jest.fn(),
    };
    await expect(allocatePositionCapital(
      {
        position: { ...first.position, effectiveAmount: 100000n },
        amount: '50000',
        allocationType: 'channel-capital',
        purpose: 'omnia-channel-capital',
        target: { type: 'channel', params: { localAmount: 25000n, remoteAmount: 25000n } as never },
        ctx: { omnia: port },
      },
      first.registry,
    )).rejects.toThrow(/risk-adjusted headroom/);
    expect(port.createChannel).not.toHaveBeenCalled();
  });

  it('OMN-113: refuses a target that deploys a different amount', async () => {
    const { manifest, registry: reg } = createOmniaPool(basePoolParams(), registry);
    const { position, state } = await makeDeposit(
      { pool: manifest, lpAddress: lp, amount: '100000', purpose: 'omnia-channel-capital' },
      reg,
    );
    const port: OmniaExecutionPort = {
      createChannel: jest.fn(),
      updateState: jest.fn(),
      addHTLC: jest.fn(),
      fulfillHTLC: jest.fn(),
      proposeSettlement: jest.fn(),
      verifyStateForCoSign: jest.fn().mockResolvedValue({ valid: true, errors: [] }),
      closeChannel: jest.fn(),
    };
    await expect(allocatePositionCapital(
      {
        position,
        amount: '40000',
        allocationType: 'channel-capital',
        purpose: 'omnia-channel-capital',
        target: { type: 'channel', params: { localAmount: 10000n, remoteAmount: 10000n } as never },
        ctx: { omnia: port },
      },
      state,
    )).rejects.toThrow(/deploys 20000 but the allocation is 40000/);
    expect(port.createChannel).not.toHaveBeenCalled();
  });

  it('OMN-114: parks a release without recovery evidence and restores liquidity only after confirmation', async () => {
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

    const parked = releaseAllocation({ allocation, position: allocPos }, allocReg);
    expect(parked.recovered).toBe(false);
    expect(parked.allocation.status).toBe('settling');
    expect(parked.position.allocatedAmount).toBe(60000n);
    expect(parked.position.availableAmount).toBe(40000n);

    const confirmed = confirmAllocationRecovery({
      allocation: parked.allocation,
      position: parked.position,
      recovery: { evidenceRef: 'channel-close-tx', recoveredAmount: 60000n, verified: true },
    }, parked.registry);
    expect(confirmed.allocation.status).toBe('released');
    expect(confirmed.position.allocatedAmount).toBe(0n);
    expect(confirmed.position.availableAmount).toBe(100000n);

    expect(() => confirmAllocationRecovery({
      allocation: parked.allocation,
      position: parked.position,
      recovery: { evidenceRef: 'unverified', recoveredAmount: 60000n, verified: false },
    }, parked.registry)).toThrow(/verified settlement evidence/);
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
        recovery: { evidenceRef: 'recovered', recoveredAmount: 50000n, verified: true },
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
    const vtxoPool = { poolId: 'vtxo-pool-2' } as unknown as import('@totemsdk/vtxo').OmniaVtxoPool;
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
        recovery: { evidenceRef: 'recovered', recoveredAmount: 50000n, verified: true },
        toTarget: { type: 'vtxo', pool: vtxoPool, params: { owner: lp, amount: 30000n, nonce: 'n2' } },
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

    const { feeRecord, registry: feeReg } = await recordPoolFee(
      {
        pool: manifest,
        position,
        grossAmount: '10000',
        source: 'route-fee',
        earnProof: { htlcId: 'h-1' },
        feeProofVerifier: passFeeProofVerifier,
      },
      state,
    );
    expect(feeRecord.grossFeeAmount).toBe(10000n);
    expect(feeRecord.lpFeeAmount).toBe(50n);
    expect(feeRecord.operatorFeeAmount).toBe(10n);
    expect(feeRecord.verified).toBe(true);

    const view = toOmniaPoolFeeRecord(feeRecord);
    expect(view.amount).toBe('10000');
    expect(view.positionId).toBe(position.positionId);

    const payoutRef = { payoutId: 'p-1', nonce: 'n1', kind: 'vtxo-mint' as const };
    const { registry: withPayout } = await registerPayout(feeReg, {
      payoutRef,
      positionId: position.positionId,
      amount: 50n,
    });
    const claimed = claimFees(manifest, position, withPayout, {
      positionId: position.positionId,
      amount: '20',
      payoutRef,
    });
    expect(claimed.claimedAmount).toBe(20n);

    const compoundRef = { payoutId: 'p-2', nonce: 'n2', kind: 'channel-settlement' as const };
    const { registry: withCompoundPayout } = await registerPayout(claimed.registry, {
      payoutRef: compoundRef,
      positionId: position.positionId,
      amount: 30n,
    });
    const compounded = compoundFees(manifest, position, withCompoundPayout, {
      positionId: position.positionId,
      payoutRef: compoundRef,
    });
    expect(compounded.compoundedAmount).toBe(30n);
    expect(compounded.position.amount).toBe(100030n);
  });

  it('refuses to claim or compound fees without a settled payout', async () => {
    const { manifest, registry: reg } = createOmniaPool(basePoolParams(), registry);
    const { position, state } = await makeDeposit(
      { pool: manifest, lpAddress: lp, amount: '100000', purpose: 'omnia-channel-capital' },
      reg,
    );
    const { registry: feeReg } = await recordPoolFee(
      {
        pool: manifest,
        position,
        grossAmount: '10000',
        source: 'route-fee',
        earnProof: { htlcId: 'h-1' },
        feeProofVerifier: passFeeProofVerifier,
      },
      state,
    );
    expect(() =>
      claimFees(manifest, position, feeReg, { positionId: position.positionId }),
    ).toThrow(/payoutRef/);
    expect(() =>
      compoundFees(manifest, position, feeReg, { positionId: position.positionId }),
    ).toThrow(/payoutRef/);
  });

  it('computes pool NAV and risk score', async () => {
    const { manifest, registry: reg } = createOmniaPool(basePoolParams(), registry);
    const { position, state } = await makeDeposit(
      { pool: manifest, lpAddress: lp, amount: '100000', purpose: 'omnia-channel-capital' },
      reg,
    );
    const { registry: afterFee } = await recordPoolFee(
      {
        pool: manifest,
        position,
        grossAmount: '20000',
        source: 'route-fee',
        earnProof: { htlcId: 'h-1' },
        feeProofVerifier: passFeeProofVerifier,
      },
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
      {
        pool: manifest,
        position,
        intent: approved,
        recipientAddress: lp,
        settlement: settlementFor(manifest, position, approved, lp),
        settlementVerifier: passSettlementVerifier,
      },
      approvedReg,
    );
    expect(result.intent.status).toBe('settled-externally');
    expect(result.position.amount).toBe(70000n);
    expect(result.position.availableAmount).toBe(70000n);
  });

  it('payouts a channel-backed position via ctx.loadChannel', async () => {
    const channel = {
      channelId: 'ch-9',
      status: 'open',
      parties: [{ partyId: 'lp-party', publicKeyDigest: '0x00', addressIndex: 0, settlementAddress: lp }],
      balances: { 'lp-party': 20000n },
    } as unknown as import('@totemsdk/omnia').OmniaChannel;
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
        settlement: settlementFor(manifest, position, approved, lp, {
          evidenceRef: 'idx-2',
          txpowId: 'tx-2',
          status: 'offchain-final',
        }),
        settlementVerifier: passSettlementVerifier,
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

// ─────────────────────────────────────────────────────────────────────────────
// OMN-090/091/092 — payout consumes authoritative state
// ─────────────────────────────────────────────────────────────────────────────

describe('payout authority, reconciliation and receipts', () => {
  async function approvedWithdrawal(amount = '30000') {
    const { manifest, registry: reg } = createOmniaPool(basePoolParams(), registry);
    const { position, state } = await makeDeposit(
      { pool: manifest, lpAddress: lp, amount: '100000', purpose: 'omnia-channel-capital' },
      reg,
    );
    const { intent, state: withIntent } = withdrawLiquidity(
      manifest,
      position,
      { positionId: position.positionId, amount, recipientAddress: lp },
      state,
    );
    const { intent: approved, registry: approvedReg } = approveWithdrawal(intent, position, withIntent);
    return { manifest, position, approved, approvedReg };
  }

  function payout(manifest: typeof registry extends never ? never : any, position: any, approved: any, reg: any, overrides: Record<string, unknown> = {}) {
    return executePoolPayout(
      {
        pool: manifest,
        position,
        intent: approved,
        recipientAddress: lp,
        settlement: settlementFor(manifest, position, approved, lp),
        settlementVerifier: passSettlementVerifier,
        ...overrides,
      } as any,
      reg,
    );
  }

  it('OMN-090: rejects a caller-supplied position that disagrees with the registry', async () => {
    const { manifest, position, approved, approvedReg } = await approvedWithdrawal();
    const inflated = { ...position, amount: position.amount + 50000n };
    await expect(payout(manifest, inflated, approved, approvedReg))
      .rejects.toThrow(/disagree with the registry \(position.amount\)/);
  });

  it('OMN-090: rejects an intent the registry does not hold', async () => {
    const { manifest, position, approved, approvedReg } = await approvedWithdrawal();
    const unknown = { ...approved, withdrawalId: 'wd-not-recorded' };
    await expect(payout(manifest, position, unknown, approvedReg))
      .rejects.toThrow(/is not recorded against position/);
  });

  it('OMN-090: pays the registry amount, not the caller copy', async () => {
    const { manifest, position, approved, approvedReg } = await approvedWithdrawal();
    const result = await payout(manifest, position, approved, approvedReg);
    expect(result.position.amount).toBe(70000n);
  });

  it('OMN-091: a partial withdrawal preserves allocations and reservations', async () => {
    const { manifest, position, approved, approvedReg } = await approvedWithdrawal();
    const allocated = { ...approvedReg.positions[position.positionId]!, allocatedAmount: 20000n, reservedAmount: 5000n, availableAmount: 75000n };
    const reg = { ...approvedReg, positions: { ...approvedReg.positions, [position.positionId]: allocated } };

    const result = await payout(manifest, allocated, approved, reg);
    expect(result.position.allocatedAmount).toBe(20000n);
    expect(result.position.reservedAmount).toBe(5000n);
    expect(result.position.availableAmount).toBe(45000n);
    expect(result.position.amount).toBe(70000n);
    // available never rises because of a withdrawal
    expect(result.position.availableAmount!).toBeLessThan(75000n);
  });

  it('OMN-091: refuses a withdrawal that would dip into allocated capital', async () => {
    const { manifest, position, approved, approvedReg } = await approvedWithdrawal();
    const allocated = { ...approvedReg.positions[position.positionId]!, allocatedAmount: 90000n, availableAmount: 10000n };
    const reg = { ...approvedReg, positions: { ...approvedReg.positions, [position.positionId]: allocated } };
    await expect(payout(manifest, allocated, approved, reg))
      .rejects.toThrow(/exceeds available liquidity/);
  });

  it('OMN-092: a receipt-backed position must have its receipt in the registry', async () => {
    const { manifest, position, approved, approvedReg } = await approvedWithdrawal();
    const withReceipt = { ...approvedReg.positions[position.positionId]!, receiptId: 'rcpt-missing' };
    const reg = { ...approvedReg, positions: { ...approvedReg.positions, [position.positionId]: withReceipt } };
    await expect(payout(manifest, withReceipt, approved, reg))
      .rejects.toThrow(/missing from the registry/);
  });

  it('OMN-092: a partial withdrawal consumes the receipt and issues a successor', async () => {
    const { manifest, position, approved, approvedReg } = await approvedWithdrawal();
    const receipt = issueLiquidityReceipt({
      position: approvedReg.positions[position.positionId]!,
      poolId: approvedReg.positions[position.positionId]!.poolId,
      ownerAddress: lp,
    });
    const withReceipt = { ...approvedReg.positions[position.positionId]!, receiptId: receipt.receiptId };
    const reg = {
      ...approvedReg,
      positions: { ...approvedReg.positions, [position.positionId]: withReceipt },
      receipts: { ...approvedReg.receipts, [receipt.receiptId]: receipt },
    };

    const result = await payout(manifest, withReceipt, approved, reg);

    const original = result.registry.receipts[receipt.receiptId]!;
    expect(original.consumedIntentId).toBe(approved.withdrawalId);

    const successorId = result.position.receiptId!;
    expect(successorId).not.toBe(receipt.receiptId);
    const successor = result.registry.receipts[successorId]!;
    expect(successor.amount).toBe(70000n);
    expect(successor.consumedAt).toBeUndefined();
  });
});
});
