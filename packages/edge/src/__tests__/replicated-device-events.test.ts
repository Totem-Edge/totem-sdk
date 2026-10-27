import { EdgeReplicatedDeviceHistory } from '../replicated-device-events.js';

function fakeLog() {
  const records: any[] = [];
  return {
    async append(record: any) {
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

describe('edge replicated device history', () => {
  it('appends and validates device events', async () => {
    const history = new EdgeReplicatedDeviceHistory(fakeLog());
    await history.append({ eventId: 'e1', deviceId: 'd1', kind: 'boot', at: 1 });
    const seen: string[] = [];
    for await (const entry of history.readSince()) seen.push(entry.record.eventId);
    expect(seen).toEqual(['e1']);
    await expect(history.append({ eventId: '', deviceId: 'd1', kind: 'boot', at: 1 }))
      .rejects.toThrow('eventId');
  });
});
