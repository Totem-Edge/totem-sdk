import { encodeMessage, decodeMessage, FramingError } from '../framing';
import { checkVersion } from '../version';
import { authDigest, signMessage, verifyMessageAuth } from '../auth';
import { PROTOCOL_VERSION } from '../messages';
import type { LookupMessage, PingMessage, GetCoinsMessage } from '../messages';

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

describe('auth — WOTS digest + sign/verify (RFC-032)', () => {
  const PK = 'ab'.repeat(32);
  const msg: GetCoinsMessage = { type: 'GET_COINS', version: 2, payload: { address: 'Mx1' } };

  it('authDigest produces a 32-byte Uint8Array', () => {
    const d = authDigest(msg, 0, Date.now() + 60_000);
    expect(d).toBeInstanceOf(Uint8Array);
    expect(d.length).toBe(32);
  });

  it('authDigest excludes auth/sig and binds nonce + expiry', () => {
    const base = authDigest(msg, 1, 1000);
    const withAuth = { ...msg, auth: { rootPublicKey: PK, signature: 'de', nonce: 1, expiresAt: 1000 } };
    const d2 = authDigest(withAuth as unknown as Omit<LookupMessage, 'auth' | 'sig'>, 1, 1000);
    expect(Array.from(base)).toEqual(Array.from(d2));
    // Different nonce/expiry ⇒ different digest.
    expect(Array.from(authDigest(msg, 2, 1000))).not.toEqual(Array.from(base));
    expect(Array.from(authDigest(msg, 1, 2000))).not.toEqual(Array.from(base));
  });

  it('signMessage attaches a WOTS auth envelope', async () => {
    const fakeSig = new Uint8Array(64).fill(0xab);
    const signed = await signMessage(msg, async () => fakeSig, PK, { nonce: 7, expiresAt: Date.now() + 60_000 });
    expect(signed.auth?.rootPublicKey).toBe(PK);
    expect(signed.auth?.signature).toBe('ab'.repeat(64));
    expect(signed.auth?.nonce).toBe(7);
  });

  it('verifyMessageAuth returns false when auth absent', async () => {
    expect(await verifyMessageAuth(msg, async () => true)).toBe(false);
  });

  it('verifyMessageAuth returns true when the verifier accepts and not expired', async () => {
    const signed = await signMessage(msg, async () => new Uint8Array(64).fill(0xcd), PK, {
      nonce: 1,
      expiresAt: Date.now() + 60_000,
    });
    expect(await verifyMessageAuth(signed, async () => true)).toBe(true);
  });

  it('verifyMessageAuth returns false when the verifier rejects', async () => {
    const signed = await signMessage(msg, async () => new Uint8Array(64).fill(0xcd), PK, {
      nonce: 1,
      expiresAt: Date.now() + 60_000,
    });
    expect(await verifyMessageAuth(signed, async () => false)).toBe(false);
  });

  it('verifyMessageAuth returns false for an expired envelope', async () => {
    const signed = await signMessage(msg, async () => new Uint8Array(64).fill(0xcd), PK, {
      nonce: 1,
      expiresAt: 1000,
    });
    expect(await verifyMessageAuth(signed, async () => true, 2000)).toBe(false);
  });
});
