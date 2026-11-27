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

  it('keeps an explicit empty hop list as the final-hop marker', () => {
    const codec = createCleartextRoutingCodec();
    expect(codec.peel(codec.build([]), { publicKeyDigest: 'Z' }).kind).toBe('final');
    expect(codec.peel('[]', { publicKeyDigest: 'Z' }).kind).toBe('final');
  });

  it('reports invalid for malformed envelopes (OMN-119)', () => {
    const codec = createCleartextRoutingCodec();
    const peeled = codec.peel('not-json', { publicKeyDigest: 'Z' });
    expect(peeled.kind).toBe('invalid');
    if (peeled.kind === 'invalid') expect(peeled.reason).toMatch(/JSON/);
  });

  it('OMN-119: rejects a hop with no destination instead of treating it as final', () => {
    const codec = createCleartextRoutingCodec();
    expect(codec.peel(JSON.stringify([{ amount: '10', tokenId: '0x00' }]), { publicKeyDigest: 'Z' }).kind).toBe('invalid');
    expect(codec.peel(JSON.stringify({}), { publicKeyDigest: 'Z' }).kind).toBe('invalid');
  });

  it('carries each hop timeout so a forwarder can bound the outgoing HTLC', () => {
    const codec = createCleartextRoutingCodec();
    const envelope = codec.build([
      { channelId: '0x1', from: 'A', to: 'B', amount: 90n, tokenId: '0x00', timeoutBlock: 100n },
      { channelId: '0x2', from: 'B', to: 'C', amount: 80n, tokenId: '0x00', timeoutBlock: 95n },
    ]);
    const first = codec.peel(envelope, { publicKeyDigest: 'A' });
    expect(first.kind).toBe('forward');
    if (first.kind !== 'forward') return;
    expect(first.next.timeoutBlock).toBe(100n);
    const second = codec.peel(first.onward!, { publicKeyDigest: 'B' });
    if (second.kind !== 'forward') throw new Error('expected a forward');
    expect(second.next.timeoutBlock).toBe(95n);
  });

  it('declares that the cleartext codec provides no path privacy', () => {
    // A capability manifest must not claim path privacy while this codec ships.
    expect(createCleartextRoutingCodec().pathPrivacy).toBe('cleartext');
  });
});
