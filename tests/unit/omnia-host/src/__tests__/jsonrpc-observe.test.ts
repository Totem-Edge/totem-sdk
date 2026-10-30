import { ObservationBus } from '../observe/bus.js';
import { ObservationEmitter } from '../observe/emitter.js';
import { createObservationSnapshot } from '../observe/snapshot.js';
import { createMemoryObservationStore, type ObservationStore } from '../observe/index.js';
import { createControlServer, type ControlServer } from '../api/jsonrpc.js';

async function readSseEvent(url: string, timeoutMs = 3000, stopAt = 'event: observation'): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let text = '';
  try {
    const res = await fetch(url, { signal: controller.signal });
    expect(res.status).toBe(200);
    const reader = res.body?.getReader();
    if (!reader) return '';
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      text += Buffer.from(value).toString('utf8');
      if (text.includes(stopAt)) break;
    }
  } catch (error) {
    if ((error as Error).name !== 'AbortError') throw error;
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
  return text;
}

describe('control-plane observation feed', () => {
  let store: ObservationStore;
  let server: ControlServer;
  let base: string;

  beforeAll(async () => {
    store = await createMemoryObservationStore({ namespace: 'test:jsonrpc-observe:' });
    const bus = new ObservationBus();
    const emitter = new ObservationEmitter({ store, bus, networkId: 'test', sourceNodeId: 'host-a' });
    await emitter.emit({
      domain: 'channel', kind: 'channel.opened', phase: 'accepted',
      entity: { type: 'channel', id: 'ch-1' },
      amounts: { capacity: '100' },
    });
    server = createControlServer({
      host: '127.0.0.1',
      port: 0,
      isReady: () => true,
      observe: {
        store,
        bus,
        snapshot: async () => createObservationSnapshot({
          networkId: 'test',
          sourceNodeId: 'host-a',
          streamId: 'host-a:test',
          cursor: await store.head(),
          channels: [],
        }),
      },
    });
    await server.listen();
    base = `http://127.0.0.1:${server.address!.port}`;
  });

  afterAll(async () => {
    await server.close();
    await store.close();
  });

  it('serves a snapshot at the journal cursor', async () => {
    const res = await fetch(`${base}/observe/snapshot`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { cursor: number; state: { channels: unknown[] } };
    expect(body.cursor).toBe(1);
    expect(Array.isArray(body.state.channels)).toBe(true);
  });

  it('replays and tails observations over SSE', async () => {
    const text = await readSseEvent(`${base}/observe/events?after=0`);
    expect(text).toContain('event: observation');
    expect(text).toContain('"channel.opened"');
  });

  it('respects the after cursor', async () => {
    const text = await readSseEvent(`${base}/observe/events?after=1`, 3000, 'event: cursor');
    expect(text).toContain('event: cursor');
    expect(text).not.toContain('"channel.opened"');
  });
});

describe('control-plane observation auth', () => {
  it('requires the bearer token when configured', async () => {
    const store = await createMemoryObservationStore({ namespace: 'test:jsonrpc-observe-auth:' });
    const server = createControlServer({
      host: '127.0.0.1',
      port: 0,
      isReady: () => true,
      authToken: 'secret',
      observe: {
        store,
        bus: new ObservationBus(),
        snapshot: async () => createObservationSnapshot({
          networkId: 'test', sourceNodeId: 'host-a', streamId: 'host-a:test', cursor: 0,
        }),
      },
    });
    await server.listen();
    const base = `http://127.0.0.1:${server.address!.port}`;
    try {
      expect((await fetch(`${base}/observe/snapshot`)).status).toBe(403);
      const ok = await fetch(`${base}/observe/snapshot`, { headers: { authorization: 'Bearer secret' } });
      expect(ok.status).toBe(200);
    } finally {
      await server.close();
      await store.close();
    }
  });
});
