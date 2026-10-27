import { codec } from '@totemsdk/storage/codec';
import { defineDataset } from '@totemsdk/replication';
import { AgentReceiptLog, DeviceEventHistory, ReplicatedManifestStore } from '../consumers.js';

const logDescriptor = defineDataset({
  datasetId: 'test.consumer.events',
  datasetVersion: 1,
  codecVersion: codec.version,
  writerModel: 'single-writer',
  encryptionProfile: 'none',
  retention: 'full',
});

function fakeLog<T>() {
  const records: T[] = [];
  return {
    async append(record: T) { records.push(record); return { length: records.length, head: `h:${records.length}` }; },
    async *readSince(cursor?: string) {
      const start = cursor ? Number(cursor.split(':')[1]) : 0;
      for (let i = start; i < records.length; i += 1) yield { cursor: `h:${i + 1}`, record: records[i] };
    },
    status() { return { connectedPeers: 0, localHead: records.length ? `h:${records.length}` : null, observedHeads: [], syncing: false }; },
    async close() {},
  };
}

describe('Phase 4 consumers', () => {
  it('validates and replays device event history', async () => {
    const history = new DeviceEventHistory(fakeLog());
    await history.append({ eventId: 'e1', deviceId: 'd1', occurredAt: 1, kind: 'boot' });
    await history.append({ eventId: 'e2', deviceId: 'd1', occurredAt: 2, kind: 'telemetry' });
    const seen: string[] = [];
    for await (const entry of history.readSince('h:1')) seen.push(entry.record.eventId);
    expect(seen).toEqual(['e2']);
    await expect(history.append({ eventId: '', deviceId: 'd1', occurredAt: 1, kind: 'x' }))
      .rejects.toThrow('eventId');
    expect(logDescriptor.datasetId).toBe('test.consumer.events');
  });

  it('stores manifests with a verifiable digest', async () => {
    const data = new Map<string, unknown>();
    const store = new ReplicatedManifestStore({
      get: async (key) => data.get(key) ?? null,
      put: async (key, value) => { data.set(key, value); },
    });
    const published = await store.publish('m1', 1, { a: 1 });
    expect((await store.get('m1'))?.digest).toBe(published.digest);
    data.set('manifest:m1', { ...published, body: { a: 2 } });
    await expect(store.get('m1')).rejects.toMatchObject({ code: 'corrupt' });
  });

  it('appends agent receipts', async () => {
    const log = new AgentReceiptLog(fakeLog());
    await log.append({ receiptId: 'r1', actionId: 'a1', agentId: 'g1', issuedAt: 1, digest: 'd1' });
    const seen: string[] = [];
    for await (const entry of log.readSince()) seen.push(entry.record.receiptId);
    expect(seen).toEqual(['r1']);
    await expect(log.append({ receiptId: 'r2', actionId: '', agentId: 'g1', issuedAt: 1, digest: 'd2' }))
      .rejects.toThrow('actionId');
  });
});
