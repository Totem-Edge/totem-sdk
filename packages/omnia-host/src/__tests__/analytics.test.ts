import { DuckDbAnalyticsStore, initializeDuckDb } from '../stores/analytics.js';

describe('DuckDbAnalyticsStore', () => {
  it('uses the documented append/query contract', async () => {
    const rows: any[] = [];
    const db = {
      run: jest.fn(async (_sql: string, ...params: unknown[]) => { if (params.length) rows.push(params); }),
      all: jest.fn(async () => rows.map(([eventId, kind, occurredAt, channelId, operationId, payloadJson]) => ({
        event_id: eventId, kind, occurred_at: occurredAt, channel_id: channelId, operation_id: operationId, payload_json: payloadJson,
      }))),
      close: jest.fn(async () => undefined),
    };
    await initializeDuckDb(db as any);
    const store = new DuckDbAnalyticsStore(db as any);
    await store.append({ eventId: 'event-1', kind: 'payment', occurredAt: 1, payload: { amount: '10' } });
    await expect(store.query()).resolves.toEqual([expect.objectContaining({ eventId: 'event-1', kind: 'payment' })]);
  });
});
