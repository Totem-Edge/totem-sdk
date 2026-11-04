/**
 * RFC-048 / replication hardening — pure quota and dataset-cipher contracts.
 *
 * The socket/hypercore integration suite lives in
 * `tests/qualification/replication-holepunch`; these are the unit-level
 * invariants it depends on.
 */

import { ReplicationQuota, ReplicationQuotaExceededError, createAesGcmDatasetCipher } from '../replication-security.js';

describe('ReplicationQuota', () => {
  it('accounts bytes and records independently', () => {
    const quota = new ReplicationQuota({ maxBytes: 10, maxRecords: 2 });
    quota.consume(4, 1);
    quota.consume(6, 1);
    expect(quota.usedBytes).toBe(10);
    expect(quota.usedRecords).toBe(2);
  });

  it('refuses a record that would exceed the byte ceiling', () => {
    const quota = new ReplicationQuota({ maxBytes: 10, maxRecords: 10 });
    quota.consume(9, 1);
    expect(() => quota.consume(2, 1)).toThrow(ReplicationQuotaExceededError);
    expect(quota.usedBytes).toBe(9);
    expect(quota.usedRecords).toBe(1);
  });

  it('refuses a record that would exceed the record ceiling', () => {
    const quota = new ReplicationQuota({ maxBytes: 100, maxRecords: 1 });
    quota.consume(1, 1);
    expect(() => quota.consume(1, 1)).toThrow(/replication quota exceeded/);
  });

  it('rejects negative consumption and resets', () => {
    const quota = new ReplicationQuota({ maxBytes: 10, maxRecords: 10 });
    expect(() => quota.consume(-1, 1)).toThrow(/non-negative/);
    quota.consume(5, 1);
    quota.reset();
    expect(quota.usedBytes).toBe(0);
    expect(quota.usedRecords).toBe(0);
  });
});

describe('createAesGcmDatasetCipher', () => {
  it('round-trips bytes and rejects a tampered ciphertext', async () => {
    const cipher = await createAesGcmDatasetCipher(new Uint8Array(32).fill(7));
    const plaintext = new TextEncoder().encode('replicated dataset payload');
    const sealed = await cipher.encrypt(plaintext);
    const opened = await cipher.decrypt(sealed);
    expect(Buffer.from(opened).toString('utf8')).toBe('replicated dataset payload');

    const tampered = new Uint8Array(sealed);
    tampered[tampered.length - 1] ^= 0xff;
    await expect(cipher.decrypt(tampered)).rejects.toThrow();
  });
});
