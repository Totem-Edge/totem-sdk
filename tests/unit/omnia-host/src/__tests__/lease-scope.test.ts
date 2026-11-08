/**
 * RFC-078 — host leases must allocate globally across channel/purpose labels.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadConfigFromEnv } from '../config.js';
import { createHostSigning } from '../signing.js';

const HEX_SEED = '0x' + 'ab'.repeat(32);

describe('omnia-host lease scope', () => {
  it('does not restart the leaf cursor for each channel tree label', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'omnia-lease-scope-'));
    const dbPath = path.join(dir, 'host.db');
    try {
      const signing = createHostSigning(loadConfigFromEnv({
        OMNIA_HOST_SEED: HEX_SEED,
        OMNIA_HOST_DB: dbPath,
      }));

      const first = await signing.leaseProvider.reserveKeyUse({
        treeId: 'omnia-channel-a',
        purpose: 'channel-update',
        payloadHash: 'payload-a',
      });
      const second = await signing.leaseProvider.reserveKeyUse({
        treeId: 'omnia-channel-b',
        purpose: 'channel-update',
        payloadHash: 'payload-b',
      });
      const third = await signing.leaseProvider.reserveKeyUse({
        treeId: 'omnia-manifest',
        purpose: 'manifest',
        payloadHash: 'payload-c',
      });

      const flat = (i: { addressIndex: number; l1: number; l2: number }) =>
        `${i.addressIndex}:${i.l1}:${i.l2}`;
      expect(new Set([flat(first.indices), flat(second.indices), flat(third.indices)]).size).toBe(3);

      await signing.leaseProvider.burnReservation(first.reservationId, 'test');
      await signing.leaseProvider.burnReservation(second.reservationId, 'test');
      await signing.leaseProvider.burnReservation(third.reservationId, 'test');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('coordinates two host processes sharing one lease directory', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'omnia-lease-cas-'));
    const dbPath = path.join(dir, 'host.db');
    try {
      const first = createHostSigning(loadConfigFromEnv({
        OMNIA_HOST_SEED: HEX_SEED,
        OMNIA_HOST_DB: dbPath,
      }));
      const second = createHostSigning(loadConfigFromEnv({
        OMNIA_HOST_SEED: HEX_SEED,
        OMNIA_HOST_DB: dbPath,
      }));

      const [a, b] = await Promise.all([
        first.leaseProvider.reserveKeyUse({
          treeId: 'omnia-channel-a', purpose: 'channel-update', payloadHash: 'a',
        }),
        second.leaseProvider.reserveKeyUse({
          treeId: 'omnia-channel-b', purpose: 'channel-update', payloadHash: 'b',
        }),
      ]);
      expect(`${a.indices.addressIndex}:${a.indices.l1}:${a.indices.l2}`)
        .not.toBe(`${b.indices.addressIndex}:${b.indices.l1}:${b.indices.l2}`);

      await first.leaseProvider.burnReservation(a.reservationId, 'test');
      await second.leaseProvider.burnReservation(b.reservationId, 'test');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
