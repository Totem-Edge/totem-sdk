import { createPoolAnnouncement } from '../announcement.js';
import type { LiquidityPoolManifest } from '../types.js';

const MANIFEST: LiquidityPoolManifest = {
  poolId: 'pool-1',
  poolType: 'omnia-router',
  purpose: 'omnia-router-liquidity',
  asset: 'MINIMA',
  totalCapacity: 100_000n,
  minCommitment: 100n,
  lockTerms: { lockType: 'none' },
  feePolicy: { feeModel: 'pro-rata', lpFeeBps: 50, operatorFeeBps: 10 },
  riskPolicy: { maxAllocationBps: 2_500, requireIdentity: true },
  createdAt: 1_700_000_000_000,
  expiresAt: 1_800_000_000_000,
};

describe('createPoolAnnouncement', () => {
  it('projects a pool manifest into the generic announcement envelope', () => {
    const announcement = createPoolAnnouncement({
      manifest: MANIFEST,
      publisher: 'MxPUBLISHER',
      sequence: 7,
      createdAt: 1_700_000_000_000,
      expiresAt: 1_800_000_000_000,
      nonce: 'nonce-1',
      custody: { mode: 'self' },
      liquidity: { mode: 'exact', verifiedAvailable: '50000' },
    });

    expect(announcement.kind).toBe('liquidity-pool');
    expect(announcement.subjectId).toBe(MANIFEST.poolId);
    expect(announcement.subjectHash).toMatch(/^0x[0-9a-f]{64}$/);
    expect(announcement.publisher).toBe('MxPUBLISHER');
    expect(announcement.payload?.capacity).toBe('100000');
    expect(announcement.payload?.poolType).toBe('omnia-router');
    expect(announcement.topics).toHaveLength(2);
    expect(announcement.announcementId).toMatch(/^0x[0-9a-f]{64}$/);
  });
});
