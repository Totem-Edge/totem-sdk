import { createEncryptedBackupRecord, restoreEncryptedBackupRecord } from '../encrypted-backup';

const cipher = {
  async encrypt(bytes: Uint8Array) { return new Uint8Array(bytes.map((b) => b ^ 0x5a)); },
  async decrypt(bytes: Uint8Array) { return new Uint8Array(bytes.map((b) => b ^ 0x5a)); },
};

describe('encrypted backup envelope', () => {
  it('round-trips and detects a tampered ciphertext', async () => {
    const state = new TextEncoder().encode('statechain-state');
    const record = await createEncryptedBackupRecord({
      backupId: 'b1', version: 1, state, cipher, now: 10,
    });
    expect(new TextDecoder().decode(await restoreEncryptedBackupRecord({ record, cipher }))).toBe('statechain-state');
    const tampered = { ...record, ciphertext: new Uint8Array(record.ciphertext.map((b) => b ^ 1)) };
    await expect(restoreEncryptedBackupRecord({ record: tampered, cipher })).rejects.toThrow('digest mismatch');
  });
});
