import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { createAuditRecorder, SqliteAuditStore } from '../stores/audit.js';
import type { SignerAuditRecord } from '../signer-port.js';

function record(overrides: Partial<SignerAuditRecord> = {}): SignerAuditRecord {
  return {
    requestId: 'req-1',
    domain: 'channel',
    mode: 'hosted',
    disclosureId: '0x' + 'aa'.repeat(32),
    acknowledgementId: 'ack-1',
    signer: '0x' + 'bb'.repeat(32),
    decision: 'allow',
    amount: '100',
    summary: 'Open channel',
    occurredAt: 1_700_000_000_000,
    ...overrides,
  };
}

describe('SqliteAuditStore', () => {
  const dbPath = path.join(
    os.tmpdir(),
    `omnia-audit-${Date.now()}-${Math.random().toString(36).slice(2)}.sqlite`,
  );

  afterAll(() => {
    fs.rmSync(dbPath, { force: true });
    fs.rmSync(`${dbPath}-wal`, { force: true });
    fs.rmSync(`${dbPath}-shm`, { force: true });
  });

  it('persists allow and deny decisions across reopen, newest first', async () => {
    const store = new SqliteAuditStore(dbPath);
    store.append(record({ requestId: 'req-allow', decision: 'allow' }));
    await new Promise((resolve) => setTimeout(resolve, 2));
    store.append(record({ requestId: 'req-deny', decision: 'deny', reason: 'no ack' }));
    store.close();

    const reopened = new SqliteAuditStore(dbPath);
    const entries = reopened.list(10);
    reopened.close();

    expect(entries).toHaveLength(2);
    expect(entries[0]?.requestId).toBe('req-deny');
    expect(entries[0]?.reason).toBe('no ack');
    expect(entries[1]?.decision).toBe('allow');
    expect(entries[0]?.auditId).toBeTruthy();
    expect(entries[0]?.recordedAt).toBeGreaterThan(0);
  });

  it('adapts to the policy signer audit callback', () => {
    const store = new SqliteAuditStore(':memory:');
    const audit = createAuditRecorder(store);
    const entry = audit(record({ requestId: 'req-cb' }));
    expect(entry.requestId).toBe('req-cb');
    expect(store.list(1)[0]?.requestId).toBe('req-cb');
    store.close();
  });

  it('does not persist secrets in audit records', () => {
    const store = new SqliteAuditStore(':memory:');
    const entry = store.append(record());
    const json = JSON.stringify(entry);
    expect(json).not.toMatch(/seed|privatekey|preimage|witness/i);
    expect(json).not.toContain('signature');
    store.close();
  });
});
