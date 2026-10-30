import {
  ReplicationQuota,
  ReplicationQuotaExceededError,
  createAesGcmDatasetCipher,
} from '../replication-security.js';

describe('encrypted dataset envelope', () => {
  it('round-trips and rejects a wrong key', async () => {
    const key = new Uint8Array(32).fill(7);
    const cipher = await createAesGcmDatasetCipher(key);
    const plaintext = new TextEncoder().encode('device telemetry');
    const envelope = await cipher.encrypt(plaintext);
    expect(Array.from(envelope.slice(0, 1))).toEqual([1]);
    expect(envelope).not.toEqual(plaintext);
    expect(new TextDecoder().decode(await cipher.decrypt(envelope))).toBe('device telemetry');

    const wrong = await createAesGcmDatasetCipher(new Uint8Array(32).fill(8));
    await expect(wrong.decrypt(envelope)).rejects.toThrow();
  });

  it('rejects a malformed or unknown envelope version', async () => {
    const cipher = await createAesGcmDatasetCipher(new Uint8Array(32).fill(1));
    await expect(cipher.decrypt(new Uint8Array([9, 1, 2, 3]))).rejects.toThrow(/envelope/);
  });
});

describe('replication quota', () => {
  it('accounts bytes and records and fails closed', () => {
    const quota = new ReplicationQuota({ maxBytes: 10, maxRecords: 2 });
    quota.consume(4);
    quota.consume(6);
    expect(quota.usedBytes).toBe(10);
    expect(quota.usedRecords).toBe(2);
    expect(() => quota.consume(1)).toThrow(ReplicationQuotaExceededError);
    expect(quota.usedBytes).toBe(10);
    quota.reset();
    expect(quota.usedBytes).toBe(0);
  });
});
