import { channelLockKey, withChannelLock } from '../channel-lock.js';

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 5));

describe('withChannelLock (CAN-013)', () => {
  it('serializes mutations for the same channel', async () => {
    const events: string[] = [];
    const work = (name: string) => withChannelLock('chan-1', async () => {
      events.push(`${name}:start`);
      await tick();
      events.push(`${name}:end`);
    });

    await Promise.all([work('a'), work('b')]);

    // Each critical section must complete before the next begins.
    expect(events).toEqual(['a:start', 'a:end', 'b:start', 'b:end']);
  });

  it('does not serialize unrelated channels', async () => {
    const events: string[] = [];
    await Promise.all([
      withChannelLock('chan-a', async () => { events.push('a:start'); await tick(); events.push('a:end'); }),
      withChannelLock('chan-b', async () => { events.push('b:start'); await tick(); events.push('b:end'); }),
    ]);
    expect(events.slice(0, 2).sort()).toEqual(['a:start', 'b:start']);
  });

  it('is re-entrant for the same channel (no deadlock)', async () => {
    const result = await withChannelLock('chan-1', async () =>
      withChannelLock('chan-1', async () => 'inner'));
    expect(result).toBe('inner');
  });

  it('releases the lock after a throw', async () => {
    await expect(withChannelLock('chan-1', async () => { throw new Error('boom'); }))
      .rejects.toThrow('boom');
    await expect(withChannelLock('chan-1', async () => 'ok')).resolves.toBe('ok');
  });

  it('derives a stable key from peer messages', () => {
    expect(channelLockKey({ channelId: 'c1' })).toBe('c1');
    expect(channelLockKey({ payload: { channelId: 'c2' } })).toBe('c2');
    expect(channelLockKey({ payload: { spliceId: 's1' } })).toBe('s1');
    expect(channelLockKey({ payload: { vcId: 'v1' } })).toBe('v1');
    expect(channelLockKey({})).toBe('peer');
  });
});
