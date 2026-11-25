/**
 * Opt-in live Axia verification for the Omnia lease adapter.
 *
 * This consumes a real WOTS lease slot on the target Axia deployment.
 * Run only with a funded, disposable test wallet:
 *
 *   AXIA_LIVE=1 \
 *   AXIA_BASE_URL=https://api.axia.to \
 *   AXIA_API_KEY=totem-shared \
 *   AXIA_ROOT_PUBLIC_KEY=0x... \
 *   AXIA_ADDRESS_INDEX=0 \
 *   pnpm exec jest --config tests/jest/wots-lease.cjs \
 *     tests/unit/wots-lease/src/__tests__/omnia-axia-live.test.ts --runInBand
 */
import { MemoryStore } from '@totemsdk/storage';
import { OmniaAxiaLeaseProvider } from '../omnia-axia.js';

const LIVE = process.env.AXIA_LIVE === '1';
const API_URL = process.env.AXIA_BASE_URL ?? '';
const API_KEY = process.env.AXIA_API_KEY ?? '';
const ROOT_PUBLIC_KEY = process.env.AXIA_ROOT_PUBLIC_KEY ?? '';
const ADDRESS_INDEX = Number(process.env.AXIA_ADDRESS_INDEX ?? '0');

(LIVE ? describe : describe.skip)('live Axia Omnia lease verification', () => {
  test('leases and consumes a real Omnia signing slot', async () => {
    expect(API_URL).toMatch(/^https?:\/\//);
    expect(API_KEY).not.toBe('');
    expect(ROOT_PUBLIC_KEY).toMatch(/^0x[0-9a-fA-F]{64}$/);
    expect(Number.isInteger(ADDRESS_INDEX)).toBe(true);

    const lease = new OmniaAxiaLeaseProvider({
      apiUrl: API_URL,
      apiKey: API_KEY,
      rootPublicKey: ROOT_PUBLIC_KEY,
      addressIndex: ADDRESS_INDEX,
      storage: new MemoryStore(),
    });

    const reservation = await lease.reserveKeyUse({
      treeId: `omnia-live-${Date.now()}`,
      payloadHash: `0x${'11'.repeat(32)}`,
      ttlMs: 60_000,
    });

    expect(reservation.leaseToken).toBeTruthy();
    expect(reservation.indices.addressIndex).toBe(ADDRESS_INDEX);

    await lease.commitKeyUse(reservation.reservationId, `0x${'22'.repeat(32)}`);
  }, 120_000);
});
