/**
 * RFC-057 Phase 4 — QVAC model-asset verification bridge.
 *
 * QVAC returns a downloaded location; this wrapper verifies the bytes against
 * the expected content address before publishing them to the Totem artifact
 * store. QVAC itself never receives signing keys or authority.
 */

import type { ArtifactRef, ArtifactStore } from '@totemsdk/storage/artifacts';
import { downloadModelAsset, type DownloadedModelAsset } from '@totemsdk/replication-holepunch';
import type { DownloadAssetOptions, QvacModelsOps } from './domains/models.js';

export interface DownloadQvacModelAssetOptions {
  models: Pick<QvacModelsOps, 'downloadAsset'>;
  request: DownloadAssetOptions;
  readBytes: (location: string) => Promise<Uint8Array>;
  store: ArtifactStore;
  namespace: string;
  expectedRef?: ArtifactRef;
}

export async function downloadQvacModelAsset(
  options: DownloadQvacModelAssetOptions,
): Promise<DownloadedModelAsset> {
  return downloadModelAsset({
    download: async () => {
      const outcome = await options.models.downloadAsset(options.request);
      if (!outcome.ok) throw new Error(outcome.message);
      return outcome.data;
    },
    readBytes: options.readBytes,
    store: options.store,
    namespace: options.namespace,
    ...(options.expectedRef ? { expectedRef: options.expectedRef } : {}),
  });
}
