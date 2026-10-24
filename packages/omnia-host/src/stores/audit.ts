/**
 * Durable signer audit store (RFC-061 D6).
 *
 * Every allow/deny decision from `createPolicySignerPort` is appended here
 * through `@totemsdk/storage` (SyncSqliteStore; same codec/envelope as the
 * host's other local state). Audit records never contain keys, seeds,
 * preimages or raw signatures.
 */

import { randomUUID } from 'node:crypto';
import { SyncSqliteStore } from '@totemsdk/storage/sqlite-sync';
import type { SignerAuditRecord } from '../signer-port.js';

export interface SignerAuditEntry extends SignerAuditRecord {
  auditId: string;
  recordedAt: number;
}

const PREFIX = 'omnia:audit:';

/** Storage-backed, append-only signer audit log. */
export class SqliteAuditStore {
  private readonly kv: SyncSqliteStore;

  constructor(path = ':memory:') {
    this.kv = new SyncSqliteStore(path);
  }

  append(record: SignerAuditRecord): SignerAuditEntry {
    const recordedAt = Date.now();
    const auditId = randomUUID();
    const entry: SignerAuditEntry = { ...record, auditId, recordedAt };
    this.kv.set(`${PREFIX}${String(recordedAt).padStart(13, '0')}:${auditId}`, entry);
    return entry;
  }

  /** Newest first. */
  list(limit = 100): SignerAuditEntry[] {
    const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 100;
    return this.kv
      .keys()
      .filter((key) => key.startsWith(PREFIX))
      .sort()
      .reverse()
      .slice(0, safeLimit)
      .map((key) => this.kv.get<SignerAuditEntry>(key))
      .filter((entry): entry is SignerAuditEntry => entry !== null);
  }

  close(): void {
    this.kv.close();
  }
}

/** Adapt the store to the `SignerPolicy.audit` callback. */
export function createAuditRecorder(
  store: SqliteAuditStore,
): (record: SignerAuditRecord) => SignerAuditEntry {
  return (record) => store.append(record);
}
