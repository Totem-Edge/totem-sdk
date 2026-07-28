import { encodeMessage, decodeMessage, FramingError } from '../framing';
import { checkVersion } from '../version';
import { messageDigest, signMessage, verifyMessageAuth } from '../auth';
import { PROTOCOL_VERSION } from '../messages';
import type { LookupMessage, PingMessage } from '../messages';

describe('framing — encode / decode round-trips', () => {
  const cases: LookupMessage[] = [
    { type: 'PING', version: 1, payload: { ts: 1234567890 } },
    { type: 'PONG', version: 1, payload: { ts: 1234567890, echo: 1234567000 } },
    { type: 'GET_TIP', version: 1, payload: {} },
    { type: 'STATUS' as unknown as 'PING', version: 1, payload: {} } as unknown as LookupMessage,
    {
      type: 'GET_COINS',
      version: 1,
      payload: { address: 'MxABC', tokenId: '0x00', sendable: true },
    },
    {
      type: 'BROADCAST_TXPOW',
      version: 1,
      payload: { txpowHex: '0xDEADBEEF' },
    },
    {
      type: 'LEASE_RESERVE',
      version: 1,
      payload: { treeId: 'tree1', deviceId: 'dev0', ttlMs: 120000, payloadHash: 'abc123' },
    },
    {
      type: 'APP_ANNOUNCE',
      version: 1,
      payload: { manifest: new Uint8Array([1, 2, 3]), appId: 'app1', expiresAt: 9999999 },
    },
    {
      type: 'TRUST_RECORD',
      version: 1,
      payload: {
        subjectId: 'app1',
        rating: 5,
        comment: 'great app',
        reviewerAddress: 'Mx123',
        signature: 'sig',
      },
    },
    {
      type: 'ERROR',
      version: 1,
      payload: { code: 'NOT_FOUND', message: 'coin not found', requestId: 'r1' },
    },
  ];

  it.each(cases.filter(c => c.type !== ('STATUS' as string)))(
    'round-trips $type',
    (msg) => {
      const encoded = encodeMessage(msg as LookupMessage);
      const decoded = decodeMessage(encoded);
      expect(decoded.type).toBe(msg.type);
      expect(decoded.version).toBe(msg.version ?? PROTOCOL_VERSION);
    },
  );

  it('round-trips Uint8Array fields correctly', () => {
    const msg: LookupMessage = {
      type: 'APP_ANNOUNCE',
      version: 1,
      payload: { manifest: new Uint8Array([10, 20, 30]), appId: 'x', expiresAt: 1 },
    };
    const decoded = decodeMessage(encodeMessage(msg));
    const decoded2 = decoded as typeof msg;
    expect(decoded2.payload.manifest).toBeInstanceOf(Uint8Array);
    expect(Array.from(decoded2.payload.manifest)).toEqual([10, 20, 30]);
  });

  it('throws FramingError on short buffer', () => {
    expect(() => decodeMessage(new Uint8Array([0, 0]))).toThrow(FramingError);
  });

  it('throws FramingError on truncated body', () => {
    const msg: PingMessage = { type: 'PING', version: 1, payload: { ts: 0 } };
    const full = encodeMessage(msg);
    expect(() => decodeMessage(full.slice(0, full.length - 2))).toThrow(FramingError);
  });
});

describe('version negotiation', () => {
  it('compatible when versions match', () => {
    expect(checkVersion(PROTOCOL_VERSION).compatible).toBe(true);
  });

  it('incompatible and returns VERSION_MISMATCH message', () => {
    const result = checkVersion(99);
    expect(result.compatible).toBe(false);
    expect(result.mismatch?.type).toBe('VERSION_MISMATCH');
    expect(result.mismatch?.payload.clientVersion).toBe(99);
    expect(result.mismatch?.payload.serverVersion).toBe(PROTOCOL_VERSION);
  });
});

describe('auth — digest + sign/verify', () => {
  it('messageDigest produces Uint8Array', () => {
    const msg: PingMessage = { type: 'PING', version: 1, payload: { ts: 1 } };
    const d = messageDigest(msg);
    expect(d).toBeInstanceOf(Uint8Array);
    expect(d.length).toBe(32);
  });

  it('digest excludes sig field', () => {
    const msg: PingMessage = { type: 'PING', version: 1, payload: { ts: 1 } };
    const d1 = messageDigest(msg);
    const msgWithSig = { ...msg, sig: 'abc123' };
    const d2 = messageDigest(msgWithSig as LookupMessage);
    expect(Array.from(d1)).toEqual(Array.from(d2));
  });

  it('signMessage attaches sig field', async () => {
    const msg: PingMessage = { type: 'PING', version: 1, payload: { ts: 1 } };
    const fakeSig = new Uint8Array(64).fill(0xab);
    const signed = await signMessage(msg, async () => fakeSig);
    expect(typeof signed.sig).toBe('string');
    expect(signed.sig).toMatch(/^[0-9a-f]+$/);
  });

  it('verifyMessageAuth returns false when sig absent', async () => {
    const msg: PingMessage = { type: 'PING', version: 1, payload: { ts: 1 } };
    const result = await verifyMessageAuth(msg, new Uint8Array(32), async () => true);
    expect(result).toBe(false);
  });

  it('verifyMessageAuth returns true when verify fn returns true', async () => {
    const msg: PingMessage = { type: 'PING', version: 1, payload: { ts: 1 } };
    const fakeSig = new Uint8Array(64).fill(0xcd);
    const signed = await signMessage(msg, async () => fakeSig);
    const result = await verifyMessageAuth(
      signed as LookupMessage,
      new Uint8Array(32),
      async () => true,
    );
    expect(result).toBe(true);
  });

  it('verifyMessageAuth returns false when verify fn returns false', async () => {
    const msg: PingMessage = { type: 'PING', version: 1, payload: { ts: 1 } };
    const fakeSig = new Uint8Array(64).fill(0xcd);
    const signed = await signMessage(msg, async () => fakeSig);
    const result = await verifyMessageAuth(
      signed as LookupMessage,
      new Uint8Array(32),
      async () => false,
    );
    expect(result).toBe(false);
  });
});
