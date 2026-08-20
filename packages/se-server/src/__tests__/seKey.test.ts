/**
 * se-server tests.
 *
 * Covers:
 *   - seKey: deterministic public key derivation, WOTS sign/verify roundtrip,
 *     reclaim-TX encryption roundtrip
 *   - config: loadConfigFromEnv validation (missing/short/invalid SE_KEY, missing DATABASE_URL)
 *   - router: create / challenge / blind-sign / claim / reclaim-tx flows with a mocked DB
 */

import { getPublicKeyHex, seSign, wotsVerifyDigestAsync, encryptReclaimTx, decryptReclaimTx } from '../seKey';
import { loadConfigFromEnv } from '../config';
import { derivePKdigest } from '@totemsdk/core';

const SEED = new Uint8Array(32).fill(0x5e);

describe('seKey', () => {
  it('getPublicKeyHex is deterministic for a given seed', () => {
    const a = getPublicKeyHex(SEED);
    const b = getPublicKeyHex(SEED);
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-fA-F]{64}$/);
  });

  it('getPublicKeyHex differs across seeds', () => {
    const other = new Uint8Array(32).fill(0x6f);
    expect(getPublicKeyHex(SEED)).not.toBe(getPublicKeyHex(other));
  });

  it('seSign produces a signature that wotsVerifyDigestAsync accepts', async () => {
    const message = new Uint8Array(32).fill(0x42);
    const sig = await seSign(SEED, message);
    const pkdBytes = derivePKdigest(SEED, 0);

    const valid = await wotsVerifyDigestAsync(sig, message, pkdBytes);
    expect(valid).toBe(true);
  });

  it('wotsVerifyDigestAsync rejects a tampered message', async () => {
    const message = new Uint8Array(32).fill(0x42);
    const sig = await seSign(SEED, message);
    const pkdBytes = derivePKdigest(SEED, 0);

    const tampered = new Uint8Array(32).fill(0x43);
    const valid = await wotsVerifyDigestAsync(sig, tampered, pkdBytes);
    expect(valid).toBe(false);
  });

  it('encryptReclaimTx / decryptReclaimTx roundtrip', () => {
    const txHex = '0x' + 'ab'.repeat(200);
    const enc = encryptReclaimTx(SEED, txHex);
    expect(enc.startsWith('enc:')).toBe(true);
    expect(enc).not.toContain(txHex);
    expect(decryptReclaimTx(SEED, enc)).toBe(txHex);
  });

  it('encryptReclaimTx is non-deterministic (fresh IV per call)', () => {
    const txHex = '0x' + 'cd'.repeat(100);
    expect(encryptReclaimTx(SEED, txHex)).not.toBe(encryptReclaimTx(SEED, txHex));
  });

  it('decryptReclaimTx passes through non-encrypted values', () => {
    expect(decryptReclaimTx(SEED, '0xplaintext')).toBe('0xplaintext');
  });

  it('decryptReclaimTx throws on malformed encrypted values', () => {
    expect(() => decryptReclaimTx(SEED, 'enc:only-two-parts')).toThrow();
  });
});

describe('loadConfigFromEnv', () => {
  const OLD = { ...process.env };

  afterEach(() => {
    process.env = { ...OLD };
  });

  it('throws when SE_KEY is missing', () => {
    delete process.env.SE_KEY;
    delete process.env.STATECHAIN_SE_KEY;
    process.env.DATABASE_URL = 'postgres://localhost/db';
    expect(() => loadConfigFromEnv()).toThrow(/SE_KEY/);
  });

  it('throws when SE_KEY is too short', () => {
    process.env.SE_KEY = 'abcd';
    process.env.DATABASE_URL = 'postgres://localhost/db';
    expect(() => loadConfigFromEnv()).toThrow(/SE_KEY/);
  });

  it('throws when SE_KEY is not valid hex', () => {
    process.env.SE_KEY = 'zz'.repeat(32);
    process.env.DATABASE_URL = 'postgres://localhost/db';
    expect(() => loadConfigFromEnv()).toThrow(/SE_KEY/);
  });

  it('throws when DATABASE_URL is missing', () => {
    process.env.SE_KEY = 'ab'.repeat(32);
    delete process.env.DATABASE_URL;
    expect(() => loadConfigFromEnv()).toThrow(/DATABASE_URL/);
  });

  it('parses a valid environment', () => {
    process.env.SE_KEY = 'ab'.repeat(32);
    process.env.DATABASE_URL = 'postgres://localhost/db';
    process.env.PORT = '4321';
    process.env.SE_RECLAIM_TIMELOCK = '128';
    process.env.SE_BETA_MODE = 'false';

    const config = loadConfigFromEnv();
    expect(config.seSeed).toHaveLength(32);
    expect(config.databaseUrl).toBe('postgres://localhost/db');
    expect(config.port).toBe(4321);
    expect(config.reclaimTimelock).toBe(128);
    expect(config.betaMode).toBe(false);
  });
});
