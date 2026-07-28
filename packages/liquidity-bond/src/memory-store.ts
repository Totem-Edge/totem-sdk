import type {
  LiquidityBondRegistryState,
  LiquidityPoolManifest,
  LiquidityCommitment,
  LiquidityPosition,
  LiquidityReceipt,
  LiquidityAllocation,
  LiquidityFeeRecord,
  WithdrawalIntent,
} from './types.js';
import {
  createEmptyLiquidityBondRegistryState,
  registerLiquidityPool,
  updateLiquidityPool,
  registerLiquidityCommitment,
  registerLiquidityPosition,
  attachLiquidityReceipt,
  attachLiquidityAllocation,
  attachLiquidityFeeRecord,
  attachWithdrawalIntent,
  getLiquidityPool,
  getLiquidityPosition,
  getLiquidityReceipt,
  listLiquidityPools,
  listPositionsByPool,
  listPositionsByLp,
  listActivePositions,
  listWithdrawablePositions,
} from './registry.js';

export class MemoryLiquidityBondStore {
  private state: LiquidityBondRegistryState;

  constructor() {
    this.state = createEmptyLiquidityBondRegistryState();
  }

  async registerPool(pool: LiquidityPoolManifest): Promise<void> {
    this.state = registerLiquidityPool(this.state, pool);
  }

  async updatePool(pool: LiquidityPoolManifest): Promise<void> {
    this.state = updateLiquidityPool(this.state, pool);
  }

  async registerCommitment(commitment: LiquidityCommitment): Promise<void> {
    this.state = registerLiquidityCommitment(this.state, commitment);
  }

  async registerPosition(position: LiquidityPosition): Promise<void> {
    this.state = registerLiquidityPosition(this.state, position);
  }

  async attachReceipt(receipt: LiquidityReceipt): Promise<void> {
    this.state = attachLiquidityReceipt(this.state, receipt);
  }

  async attachAllocation(allocation: LiquidityAllocation): Promise<void> {
    this.state = attachLiquidityAllocation(this.state, allocation);
  }

  async attachFeeRecord(record: LiquidityFeeRecord): Promise<void> {
    this.state = attachLiquidityFeeRecord(this.state, record);
  }

  async attachWithdrawalIntent(intent: WithdrawalIntent): Promise<void> {
    this.state = attachWithdrawalIntent(this.state, intent);
  }

  async getPool(poolId: string): Promise<LiquidityPoolManifest | undefined> {
    return getLiquidityPool(this.state, poolId);
  }

  async getPosition(positionId: string): Promise<LiquidityPosition | undefined> {
    return getLiquidityPosition(this.state, positionId);
  }

  async getReceipt(receiptId: string): Promise<LiquidityReceipt | undefined> {
    return getLiquidityReceipt(this.state, receiptId);
  }

  async listPools(): Promise<LiquidityPoolManifest[]> {
    return listLiquidityPools(this.state);
  }

  async listPositionsByPool(poolId: string): Promise<LiquidityPosition[]> {
    return listPositionsByPool(this.state, poolId);
  }

  async listPositionsByLp(lpAddress: string): Promise<LiquidityPosition[]> {
    return listPositionsByLp(this.state, lpAddress);
  }

  async listActivePositions(): Promise<LiquidityPosition[]> {
    return listActivePositions(this.state);
  }

  async listWithdrawablePositions(now: number): Promise<LiquidityPosition[]> {
    return listWithdrawablePositions(this.state, now);
  }

  async getSnapshot(): Promise<LiquidityBondRegistryState> {
    return JSON.parse(JSON.stringify(this.state, (_, v) => typeof v === 'bigint' ? v.toString() : v));
  }
}
