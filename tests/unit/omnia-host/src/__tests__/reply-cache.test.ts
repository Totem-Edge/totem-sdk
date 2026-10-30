import { ReplyCache } from '../reply-cache.js';
import { requestPeerReply } from '../api/methods.js';

describe('ReplyCache', () => {
  it('executes once and returns the same reply for duplicate keys', async () => {
    const cache = new ReplyCache();
    let calls = 0;
    const run = () => cache.run('k', async () => { calls += 1; return { type: 'ACK', n: calls }; });
    const [a, b] = await Promise.all([run(), run()]);
    expect(calls).toBe(1);
    expect(a).toEqual({ type: 'ACK', n: 1 });
    expect(b).toEqual(a);
    expect(await run()).toEqual(a);
    expect(calls).toBe(1);
  });

  it('keeps distinct keys independent and evicts the oldest', async () => {
    const cache = new ReplyCache(2, 60_000);
    const k1 = cache.key('VC_PROPOSAL', 'c1', 1, 'vc-open');
    const k2 = cache.key('VC_PROPOSAL', 'c2', 2, 'vc-open');
    const k3 = cache.key('VC_PROPOSAL', 'c3', 3, 'vc-open');
    await cache.run(k1, async () => 'a');
    await cache.run(k2, async () => 'b');
    await cache.run(k3, async () => 'c');
    let reran = 0;
    await cache.run(k1, async () => { reran += 1; return 'a2'; });
    expect(reran).toBe(1);
  });
});

describe('requestPeerReply', () => {
  const makePeer = () => {
    const sent: Array<{ type: string; channelId: string; nonce?: number }> = [];
    const messageHandlers: Array<(m: any) => void> = [];
    const reconnectHandlers: Array<() => void> = [];
    return {
      sent,
      emit: (m: any) => messageHandlers.forEach((cb) => cb(m)),
      reconnect: () => reconnectHandlers.forEach((cb) => cb()),
      peer: {
        sendMessage: async (m: any) => { sent.push(m); },
        onMessage: (cb: (m: any) => void) => { messageHandlers.push(cb); return () => {}; },
        onReconnected: (cb: () => void) => { reconnectHandlers.push(cb); return () => {}; },
      },
    };
  };

  it('resends the same nonce after reconnect and ignores stale replies', async () => {
    const h = makePeer();
    const promise = requestPeerReply(
      h.peer,
      { type: 'VC_PROPOSAL', channelId: 'vc1', nonce: 7 },
      'vc1',
      5_000,
      ['VC_ACCEPT', 'ERROR'],
    );
    await Promise.resolve();
    expect(h.sent).toHaveLength(1);
    h.reconnect();
    await Promise.resolve();
    expect(h.sent).toHaveLength(2);
    expect(h.sent[1].nonce).toBe(7);

    h.emit({ type: 'VC_ACCEPT', channelId: 'vc1', nonce: 6 });
    h.emit({ type: 'VC_ACCEPT', channelId: 'vc1', nonce: 7 });
    await expect(promise).resolves.toMatchObject({ type: 'VC_ACCEPT', nonce: 7 });
  });

  it('returns null on timeout', async () => {
    const h = makePeer();
    const reply = await requestPeerReply(
      h.peer,
      { type: 'FACTORY_PROPOSAL', channelId: 'f1', nonce: 1 },
      'f1',
      20,
      ['FACTORY_ACCEPT'],
    );
    expect(reply).toBeNull();
  });
});
