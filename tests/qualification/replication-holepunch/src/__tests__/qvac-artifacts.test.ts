import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sha3_256, toHex } from '@totemsdk/core';
import { ArtifactStore } from '@totemsdk/storage/artifacts';
import { LocalFileBackend } from '@totemsdk/storage/artifacts/local-fs-backend';
import { downloadModelAsset, verifyModelAssetBytes } from '../qvac-artifacts.js';

describe('QVAC model asset bridge', () => {
  let dir: string;
  let store: ArtifactStore;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'totem-qvac-assets-'));
    store = new ArtifactStore(new LocalFileBackend(join(dir, 'artifacts')));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('publishes verified bytes and exposes the stable artifact ref', async () => {
    const bytes = new TextEncoder().encode('model-weights');
    const digest = toHex(sha3_256(bytes));
    const ref = { namespace: 'totem-qvac-models', algorithm: 'sha3-256', digest } as const;

    const result = await downloadModelAsset({
      download: async () => '/tmp/model.gguf',
      readBytes: async () => bytes,
      store,
      namespace: 'totem-qvac-models',
      expectedRef: ref,
    });

    expect(result.location).toBe('/tmp/model.gguf');
    expect(result.bytes).toBe(bytes.length);
    expect(result.ref.digest).toBe(digest);
    expect(await verifyModelAssetBytes(bytes, result.ref)).toBe(true);
    expect(await store.get(result.ref)).toMatchObject({ status: 'ok' });
  });

  it('rejects a truncated/interrupted download before writing', async () => {
    const full = new TextEncoder().encode('full-model');
    const ref = {
      namespace: 'totem-qvac-models',
      algorithm: 'sha3-256',
      digest: toHex(sha3_256(full)),
    } as const;

    await expect(
      downloadModelAsset({
        download: async () => '/tmp/model.part',
        readBytes: async () => new TextEncoder().encode('partial'),
        store,
        namespace: 'totem-qvac-models',
        expectedRef: ref,
      }),
    ).rejects.toMatchObject({ code: 'corrupt' });

    const receipt = await store.put('totem-qvac-models', new TextEncoder().encode('partial'));
    expect(receipt.ref.digest).not.toBe(ref.digest);
  });

  it('accepts bytes with no expected ref and returns their address', async () => {
    const bytes = new TextEncoder().encode('opaque-model');
    const result = await downloadModelAsset({
      download: async () => '/tmp/opaque.bin',
      readBytes: async () => bytes,
      store,
      namespace: 'totem-qvac-models',
    });
    expect(result.ref.digest).toBe(toHex(sha3_256(bytes)));
  });
});
