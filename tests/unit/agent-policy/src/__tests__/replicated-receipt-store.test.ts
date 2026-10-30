import { ReplicatedReceiptStore } from '../replicated-receipt-store.js';
import type { AgentReceipt } from '../types.js';

function fakeLog() {
  const records: AgentReceipt[] = [];
  return {
    async append(record: AgentReceipt) {
      records.push(record);
      return { length: records.length, head: `h:${records.length}` };
    },
    async *readSince(cursor?: string) {
      const start = cursor ? Number(cursor.split(':')[1]) : 0;
      for (let i = start; i < records.length; i += 1) yield { cursor: `h:${i + 1}`, record: records[i] };
    },
    status: () => ({ connectedPeers: 0, localHead: null, observedHeads: [], syncing: false }),
    async close() {},
  };
}

describe('replicated agent receipt store', () => {
  it('saves, retrieves and counts receipts', async () => {
    const store = new ReplicatedReceiptStore(fakeLog());
    const id = await store.save({ proposalId: 'p1', status: 'approved' });
    expect(await store.get(id)).toMatchObject({ proposalId: 'p1', status: 'approved' });
    expect(await store.count()).toBe(1);
    expect(await store.list()).toHaveLength(1);
  });
});
