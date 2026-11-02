import { createReplicatedActionEventSink } from '../replicated-events.js';
import type { IndustrialActionEvent } from '../events.js';

function fakeLog() {
  const events: IndustrialActionEvent[] = [];
  return {
    async append(record: IndustrialActionEvent) {
      events.push(record);
      return { length: events.length, head: `h:${events.length}` };
    },
    async *readSince(cursor?: string) {
      const start = cursor ? Number(cursor.split(':')[1]) : 0;
      for (let i = start; i < events.length; i += 1) {
        yield { cursor: `h:${i + 1}`, record: events[i] };
      }
    },
    status: () => ({ connectedPeers: 0, localHead: null, observedHeads: [], syncing: false }),
    async close() {},
  };
}

describe('replicated industrial event sink', () => {
  it('mirrors the event timeline into the replicated log', async () => {
    const sink = createReplicatedActionEventSink(fakeLog());
    await sink.emit({ type: 'proposed', actionId: 'a1', at: 1 });
    await sink.emit({ type: 'authorized', actionId: 'a1', at: 2 });
    expect((await sink.list()).map((e) => e.type)).toEqual(['proposed', 'authorized']);
  });
});
