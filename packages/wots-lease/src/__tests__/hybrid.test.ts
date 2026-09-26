import { MemoryStore } from '@totemsdk/storage';
import { LocalLeaseProvider } from '../local.js';
import { HybridLeaseProvider } from '../hybrid.js';
import type { OnchainWatermarkProvider } from '../onchain.js';

interface OnchainCalls {
  publish: number;
  sync: number;
}

function fakeOnchain(calls: OnchainCalls, opts: { fail?: boolean } = {}): OnchainWatermarkProvider {
  return {
    async publishWatermark() {
      if (opts.fail) throw new Error('chain down');
      calls.publish += 1;
    },
    async syncLeaseJournal() {
      if (opts.fail) throw new Error('chain down');
      calls.sync += 1;
      return { synced: true, conflicts: [] };
    },
  } as unknown as OnchainWatermarkProvider;
}

async function setup(): Promise<{ local: LocalLeaseProvider; calls: OnchainCalls }> {
  const local = new LocalLeaseProvider(new MemoryStore());
  await local.initialize();
  return { local, calls: { publish: 0, sync: 0 } };
}

describe('HybridLeaseProvider on-chain composition', () => {
  it('publishes the watermark through the on-chain provider', async () => {
    const { local, calls } = await setup();
    const hybrid = new HybridLeaseProvider({ local, onchain: fakeOnchain(calls) });
    await hybrid.publishWatermark('default');
    expect(calls.publish).toBe(1);
  });

  it('syncs the journal through the on-chain provider', async () => {
    const { local, calls } = await setup();
    const hybrid = new HybridLeaseProvider({ local, onchain: fakeOnchain(calls) });
    const result = await hybrid.syncLeaseJournal();
    expect(calls.sync).toBe(1);
    expect(result.synced).toBe(true);
  });

  it('anchors the local cursor to the chain before a high-value reservation', async () => {
    const { local, calls } = await setup();
    const hybrid = new HybridLeaseProvider({ local, onchain: fakeOnchain(calls), threshold: 0 });
    await hybrid.reserveKeyUse({ treeId: 'default', valueHint: '10' });
    expect(calls.sync).toBe(1);
  });

  it('does not touch the chain for a low-value reservation', async () => {
    const { local, calls } = await setup();
    const hybrid = new HybridLeaseProvider({ local, onchain: fakeOnchain(calls), threshold: 1000 });
    await hybrid.reserveKeyUse({ treeId: 'default', valueHint: '10' });
    expect(calls.sync).toBe(0);
  });

  it('falls back to local when the chain is unreachable', async () => {
    const { local } = await setup();
    const hybrid = new HybridLeaseProvider({ local, onchain: fakeOnchain({ publish: 0, sync: 0 }, { fail: true }) });
    await expect(hybrid.publishWatermark('default')).resolves.toBeUndefined();
    await expect(hybrid.syncLeaseJournal()).resolves.toMatchObject({ synced: true });
  });
});
