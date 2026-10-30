import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sha3_256, toHex } from '@totemsdk/core';
import { ArtifactStore } from '@totemsdk/storage/artifacts';
import { LocalFileBackend } from '@totemsdk/storage/artifacts/local-fs-backend';
import { downloadQvacModelAsset } from '../artifacts.js';
import type { QvacModelsOps } from '../domains/models.js';

describe('QVAC model asset bridge', () => {
  let dir: string;
  let store: ArtifactStore;
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'qvac-assets-'));
    store = new ArtifactStore(new LocalFileBackend(join(dir, 'artifacts')));
  });
  afterEach(async () => { await rm(dir, { recursive: true, force: true }); });

  it('downloads, verifies and publishes a model asset', async () => {
    const bytes = new TextEncoder().encode('weights');
    const ref = { namespace: 'models', algorithm: 'sha3-256' as const, digest: toHex(sha3_256(bytes)) };
    const models = { downloadAsset: async () => ({ ok: true, requestId: 'r1', data: '/tmp/model.gguf' }) } as unknown as Pick<QvacModelsOps, 'downloadAsset'>;
    const result = await downloadQvacModelAsset({
      models, request: { assetSrc: 'hyperdrive://model' }, readBytes: async () => bytes,
      store, namespace: 'models', expectedRef: ref,
    });
    expect(result.ref.digest).toBe(ref.digest);
    expect(await store.get(result.ref)).toMatchObject({ status: 'ok' });
  });
});
