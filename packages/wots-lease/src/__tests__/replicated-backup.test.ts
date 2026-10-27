import { ReplicatedLeaseJournalBackup } from '../replicated-backup.js';
import type { JournalEntry } from '../types.js';

function entry(id: string, previousHash?: string, hash = id): JournalEntry {
  return {
    treeId: 'tree', branchId: 'branch', wotsIndex: 0,
    indices: { addressIndex: 0, l1: 0, l2: 0 },
    status: 'reserved', reservationId: id, timestamp: 1, deviceId: 'd1',
    ...(previousHash ? { previousHash } : {}), hash,
  };
}

function fakeLog(records: JournalEntry[]) {
  return {
    async append(record: JournalEntry) {
      records.push(record);
      return { length: records.length, head: `h:${records.length}` };
    },
    async *readSince(cursor?: string) {
      const start = cursor ? Number(cursor.split(':')[1]) : 0;
      for (let i = start; i < records.length; i += 1) {
        yield { cursor: `h:${i + 1}`, record: records[i] };
      }
    },
    status: () => ({ connectedPeers: 0, localHead: null, observedHeads: [], syncing: false }),
    async close() {},
  };
}

describe('replicated lease journal backup', () => {
  it('restores entries in order into a local journal', async () => {
    const records = [entry('r1'), entry('r2', 'r1', 'r2')];
    const backup = new ReplicatedLeaseJournalBackup(fakeLog(records));
    const restored: JournalEntry[] = [];
    expect(await backup.restoreInto({ append: async (e) => { restored.push(e); } })).toBe(2);
    expect(restored.map((e) => e.reservationId)).toEqual(['r1', 'r2']);
  });

  it('rejects a broken replicated hash chain', async () => {
    const records = [entry('r1'), entry('r2', 'wrong', 'r2')];
    const backup = new ReplicatedLeaseJournalBackup(fakeLog(records));
    await expect(backup.readAll()).rejects.toMatchObject({ code: 'corrupt' });
  });
});
