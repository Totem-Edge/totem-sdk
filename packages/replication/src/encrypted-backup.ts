/**
 * RFC-057 Phase 5 — encrypted backup-only state envelopes.
 *
 * Backup envelopes are deliberately not a collaborative store. They support
 * recovery of validated state for authorities such as Omnia, statechain and
 * se-server without making replication authoritative.
 */

import { sha3_256, toHex } from '@totemsdk/core';
import type { ReplicatedLog } from './types.js';

export interface BackupCipher {
  encrypt(plaintext: Uint8Array): Promise<Uint8Array>;
  decrypt(ciphertext: Uint8Array): Promise<Uint8Array>;
}

export interface EncryptedBackupRecord {
  readonly backupId: string;
  readonly version: number;
  readonly createdAt: number;
  /** SHA3-256 of the ciphertext (integrity, not confidentiality). */
  readonly digest: string;
  readonly ciphertext: Uint8Array;
}

export async function createEncryptedBackupRecord(options: {
  backupId: string;
  version: number;
  state: Uint8Array;
  cipher: BackupCipher;
  now?: number;
}): Promise<EncryptedBackupRecord> {
  if (!options.backupId) throw new Error('backupId is required');
  if (!Number.isInteger(options.version) || options.version < 1) {
    throw new Error('backup version must be a positive integer');
  }
  const ciphertext = await options.cipher.encrypt(options.state);
  return {
    backupId: options.backupId,
    version: options.version,
    createdAt: options.now ?? Date.now(),
    digest: toHex(sha3_256(ciphertext)),
    ciphertext,
  };
}

export async function restoreEncryptedBackupRecord(options: {
  record: EncryptedBackupRecord;
  cipher: BackupCipher;
}): Promise<Uint8Array> {
  const digest = toHex(sha3_256(options.record.ciphertext));
  if (digest !== options.record.digest) throw new Error('encrypted backup digest mismatch');
  return options.cipher.decrypt(options.record.ciphertext);
}

/** Append-only backup stream; consumers remain responsible for encrypting state. */
export class EncryptedBackupLog {
  constructor(private readonly log: ReplicatedLog<EncryptedBackupRecord>) {}

  async append(record: EncryptedBackupRecord): Promise<{ length: number; head: string }> {
    return this.log.append(record);
  }

  readSince(cursor?: string): AsyncIterable<{ cursor: string; record: EncryptedBackupRecord }> {
    return this.log.readSince(cursor);
  }

  close(): Promise<void> {
    return this.log.close();
  }
}
