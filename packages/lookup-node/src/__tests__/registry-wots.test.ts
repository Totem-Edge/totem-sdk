/**
 * RFC-032: registry announcement verification uses the WOTS-signed manifest.
 *
 * A real SignedManifest is produced with @totemsdk/manifest and encoded; the
 * AppRegistry verifies it on ingest. A tampered manifest is rejected.
 */

import { signManifest } from '@totemsdk/manifest';
import { encodeManifest } from '@totemsdk/manifest';
import type { AppManifest } from '@totemsdk/manifest';
import { AppRegistry } from '../registry.js';
import { SqliteStore } from '../storage.js';

jest.setTimeout(60_000);

/**
 * `signManifest` derives `authorAddress` from the seed and overwrites the
 * manifest field; `verifyManifest` then requires the two to match. So the test
 * signs a manifest whose declared author is the real signer address.
 */
async function signedManifestBytes(seedByte: number): Promise<Uint8Array> {
  const seed = new Uint8Array(32).fill(seedByte);
  // First derive the address by signing a placeholder, then sign the real one.
  const placeholder = appManifest('MxPLACEHOLDER');
  const first = await signManifest(placeholder, seed, 0);
  const realManifest = appManifest(first.authorAddress);
  const signed = await signManifest(realManifest, seed, 0);
  return encodeManifest(signed);
}

function appManifest(authorAddress: string): AppManifest {
  return {
    type: 'app',
    appId: 'app-1',
    name: 'Test App',
    version: '1.0.0',
    authorAddress,
    pearTopicKey: '00'.repeat(32),
    price: '0',
    category: ['tools'],
    permissions: [],
    description: 'test',
    minTotemVersion: '0.1.0',
  };
}

describe('AppRegistry — WOTS-signed manifest verification (RFC-032)', () => {
  it('accepts a valid WOTS-signed manifest and stores the signer address', async () => {
    const store = new SqliteStore(':memory:');
    const reg = new AppRegistry(store, true);
    const bytes = await signedManifestBytes(0x11);

    await reg.announce(
      { type: 'APP_ANNOUNCE', version: 2, payload: { manifest: bytes, appId: 'app-1', expiresAt: Date.now() + 60_000 } },
      'node-1',
    );
    expect(reg.size()).toBe(1);
    store.close();
  });

  it('rejects a tampered manifest', async () => {
    const store = new SqliteStore(':memory:');
    const reg = new AppRegistry(store, true);
    const bytes = await signedManifestBytes(0x11);
    // Flip a byte in the middle of the buffer so the signature no longer matches.
    bytes[Math.floor(bytes.length / 2)] ^= 0xff;

    await reg.announce(
      { type: 'APP_ANNOUNCE', version: 2, payload: { manifest: bytes, appId: 'app-1', expiresAt: Date.now() + 60_000 } },
      'node-1',
    );
    expect(reg.size()).toBe(0);
    store.close();
  });

  it('rejects an unsigned/garbage manifest when signatures are required', async () => {
    const store = new SqliteStore(':memory:');
    const reg = new AppRegistry(store, true);
    const bytes = new TextEncoder().encode('not a manifest');
    await reg.announce(
      { type: 'APP_ANNOUNCE', version: 2, payload: { manifest: bytes, appId: 'app-1', expiresAt: Date.now() + 60_000 } },
      'node-1',
    );
    expect(reg.size()).toBe(0);
    store.close();
  });
});
