/**
 * Durable `ActionStorage` tests (RFC-007 G6).
 *
 * ActionStorage was interface-only with no implementation; this exercises the
 * storage-backed backend: full port parity, reopen survival, concurrent save
 * safety (revision-CAS), corruption surfaced (never absence), and no silent
 * durability downgrade.
 */

import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { MemoryStore } from '@totemsdk/storage';
import { FileStore } from '@totemsdk/storage/fs';
import { StorageError } from '@totemsdk/storage/errors';
import { createDurableActionStorage } from '../durable-storage.js';
import type { ActionExecution, ActionProposal, ActionReceipt } from '../types.js';

const VOLATILE = { requireAckMode: 'volatile' as const };

const P_1: ActionProposal = {
  id: 'totem:ia:proposal:p-1',
  kind: 'valve-open',
  parameters: { target: 'v-1', targetValue: 100 },
  context: { deviceId: 'd-1' },
  proposedAt: 1000,
  commitmentHash: '0xabc',
};
const R_1: ActionReceipt = {
  receiptId: 'totem:ia:receipt:r-1',
  actionId: 'totem:ia:exec:e-1',
  proposalId: 'totem:ia:proposal:p-1',
  kind: 'valve-open',
  status: 'confirmed',
  commitmentHash: '0xabc',
  parameters: { target: 'v-1', targetValue: 100 },
  issuedAt: 1002,
};
const E_1: ActionExecution = {
  id: 'totem:ia:exec:e-1',
  proposalId: 'totem:ia:proposal:p-1',
  status: 'confirmed',
  result: { applied: true },
  startedAt: 1001,
  completedAt: 1002,
  receipt: R_1,
};

describe('createDurableActionStorage', () => {
  describe('MemoryStore (volatile) — port parity', () => {
    let store: ReturnType<typeof createDurableActionStorage>;

    beforeEach(() => {
      store = createDurableActionStorage(new MemoryStore(), VOLATILE);
    });

    it('saves and retrieves a proposal', async () => {
      const saved = await store.saveProposal(P_1);
      expect(saved.ok).toBe(true);
      const got = await store.getProposal(P_1.id);
      expect(got.ok).toBe(true);
      expect(got.data).toEqual(P_1);
    });

    it('returns not-found for a missing proposal', async () => {
      const got = await store.getProposal('totem:ia:proposal:nope');
      expect(got.ok).toBe(false);
      expect(got.errorCode).toBe('not-found');
    });

    it('saves and retrieves an execution with its receipt attached', async () => {
      await store.saveExecution(E_1);
      const got = await store.getExecution(E_1.id);
      expect(got.ok).toBe(true);
      expect(got.data?.status).toBe('confirmed');
      expect(got.data?.receipt?.receiptId).toBe(R_1.receiptId);
    });

    it('returns not-found for a missing execution', async () => {
      const got = await store.getExecution('totem:ia:exec:nope');
      expect(got.ok).toBe(false);
      expect(got.errorCode).toBe('not-found');
    });

    it('saves and retrieves a receipt (extension port)', async () => {
      await store.saveReceipt(R_1);
      const got = await store.getReceipt(R_1.receiptId);
      expect(got.ok).toBe(true);
      expect(got.data).toEqual(R_1);
      expect(got.data?.status).toBe('confirmed');
    });

    it('returns not-found for a missing receipt', async () => {
      const got = await store.getReceipt('totem:ia:receipt:nope');
      expect(got.ok).toBe(false);
      expect(got.errorCode).toBe('not-found');
    });

    it('last-writer-wins on overwrite for the same proposal id', async () => {
      await store.saveProposal(P_1);
      await store.saveProposal({ ...P_1, proposedAt: 2000 });
      const got = await store.getProposal(P_1.id);
      expect(got.data?.proposedAt).toBe(2000);
    });

    it('json-cleans undefined optional fields on write', async () => {
      const proposal: ActionProposal = {
        ...P_1,
        expiresAt: undefined,
        authorityDecision: undefined,
      };
      await store.saveProposal(proposal);
      const got = await store.getProposal(P_1.id);
      expect(got.data).toBeDefined();
      // Undefined object keys are dropped on persistence, matching codec rules.
      expect('authorityDecision' in (got.data as ActionProposal)).toBe(false);
      expect('expiresAt' in (got.data as ActionProposal)).toBe(false);
      expect((got.data as ActionProposal).kind).toBe('valve-open');
    });

    it('serializes concurrent saves without a lost update (revision-CAS)', async () => {
      const store2 = createDurableActionStorage(new MemoryStore(), VOLATILE);
      await Promise.all(
        Array.from({ length: 20 }, (_, i) =>
          store2.saveProposal({
            ...P_1,
            id: `totem:ia:proposal:p-${i}`,
            parameters: { target: 'v-1', targetValue: i },
          }),
        ),
      );
      for (let i = 0; i < 20; i++) {
        const got = await store2.getProposal(`totem:ia:proposal:p-${i}`);
        expect(got.ok).toBe(true);
      }
      expect(await store2.getRevision()).toBe(20);
      expect(await store2.hasState()).toBe(true);
    });
  });

  describe('FileStore (durably-acknowledged) — durable close/reopen', () => {
    let dir: string;

    beforeEach(async () => {
      dir = await fs.mkdtemp(join(tmpdir(), 'totem-action-'));
    });

    afterEach(async () => {
      await fs.rm(dir, { recursive: true, force: true });
    });

    it('does not fail-open on a corrupt registry record (strict)', async () => {
      const adapter = new FileStore(dir);
      const store = createDurableActionStorage(adapter);
      await store.saveProposal(P_1);

      await adapter.set('totem_action:v1:snapshot', { shreds: true });

      await expect(store.getProposal(P_1.id)).rejects.toMatchObject({ code: 'corrupt' });
      // The record is present-but-broken — presence is never reinitialised away.
      expect(await store.hasState()).toBe(true);
    });

    it('reopens on-disk state after a brand-new store instance (registry reopen gate)', async () => {
      const adapter1 = new FileStore(dir);
      const first = createDurableActionStorage(adapter1);
      await first.saveProposal(P_1);
      await first.saveExecution(E_1);
      await first.saveReceipt(R_1);

      const adapter2 = new FileStore(dir);
      const reopened = createDurableActionStorage(adapter2);
      expect((await reopened.getProposal(P_1.id)).data).toEqual(P_1);
      const exec = await reopened.getExecution(E_1.id);
      expect(exec.data?.status).toBe('confirmed');
      expect(exec.data?.receipt?.receiptId).toBe(R_1.receiptId);
      expect((await reopened.getReceipt(R_1.receiptId)).data).toEqual(R_1);
      expect(await reopened.getRevision()).toBe(3);
    });

    it('throws StorageError on tampered on-disk bytes', async () => {
      const adapter = new FileStore(dir);
      const store = createDurableActionStorage(adapter);
      await store.saveProposal(P_1);

      for (const file of await fs.readdir(dir)) {
        if (file.startsWith('.tmp')) continue;
        await fs.writeFile(join(dir, file), Buffer.from('TAMPERED'));
      }
      await expect(store.getProposal(P_1.id)).rejects.toThrow(StorageError);
    });
  });

  it('rejects a volatile adapter under the durable default (no silent downgrade)', () => {
    expect(() => createDurableActionStorage(new MemoryStore())).toThrow(
      /acknowledges "volatile" but consumer requires "durably-acknowledged"/,
    );
  });
});