/**
 * RFC-035 B4 — cleartext routing envelope codec.
 */

import { createCleartextRoutingCodec } from '../forward.js';
import type { RoutingHop } from '../types.js';

const hop = (channelId: string, from: string, to: string, amount: bigint): RoutingHop => ({
  channelId,
  from,
  to,
  amount,
  tokenId: '0x00',
});

describe('createCleartextRoutingCodec (RFC-035 B4)', () => {
  it('builds and peels the onward hops one at a time', () => {
    const codec = createCleartextRoutingCodec();
    const envelope = codec.build([hop('c1', 'A', 'B', 100n), hop('c2', 'B', 'C', 99n)]);

    const first = codec.peel(envelope, { publicKeyDigest: 'A' });
    expect(first.kind).toBe('forward');
    if (first.kind !== 'forward') return;
    expect(first.next.via).toBe('B');
    expect(first.next.amount).toBe(100n);
    expect(first.onward).toBeTruthy();

    const second = codec.peel(first.onward!, { publicKeyDigest: 'B' });
    expect(second.kind).toBe('forward');
    if (second.kind !== 'forward') return;
    expect(second.next.via).toBe('C');
    expect(second.next.amount).toBe(99n);
    expect(second.onward).toBeUndefined();
  });

  it('reports final for an empty envelope', () => {
    const codec = createCleartextRoutingCodec();
    expect(codec.peel(codec.build([]), { publicKeyDigest: 'Z' }).kind).toBe('final');
  });

  it('reports final for malformed envelopes', () => {
    const codec = createCleartextRoutingCodec();
    expect(codec.peel('not-json', { publicKeyDigest: 'Z' }).kind).toBe('final');
  });
});
