/**
 * RFC-057 Phase 2 — QVAC model-asset bridge.
 *
 * QVAC's `downloadAsset` returns a local path (or URL) and has no knowledge of
 * Totem's content-addressed artifact store. This bridge verifies the downloaded
 * bytes against the expected `ArtifactRef` before publishing them, so a
 * truncated, interrupted, or substituted download never becomes an addressable
 * artifact.
 */

import { sha3_256, toHex } from '@totemsdk/core';
import type { ArtifactRef } from '@totemsdk/storage/artifacts';

/** Structural port so ESM and CJS builds of ArtifactStore share one contract. */
export interface ArtifactStorePort {
  readonly capabilities: { readonly writable: boolean };
  put(namespace: string, bytes: Uint8Array): Promise<{ readonly ref: ArtifactRef }>;
}
import { StorageError } from '@totemsdk/storage/errors';

export interface DownloadModelAssetOptions {
  /** Awaited QVAC `downloadAsset(...)` result (local path or URL). */
  download: () => Promise<string>;
  /** Reads the bytes at the returned location. */
  readBytes: (location: string) => Promise<Uint8Array>;
  /** Writable artifact store that owns the bytes. */
  store: ArtifactStorePort;
  /** Artifact namespace, e.g. `totem-qvac-models`. */
  namespace: string;
  /**
   * Expected content address. When supplied the bytes must hash to it before
   * anything is written; a mismatch throws `StorageError('corrupt')`.
   */
  expectedRef?: ArtifactRef;
}

export interface DownloadedModelAsset {
  location: string;
  ref: ArtifactRef;
  bytes: number;
}

function digestOf(bytes: Uint8Array): string {
  return toHex(sha3_256(bytes));
}

/**
 * Download, verify, then publish a model asset. Verification happens before
 * `store.put`, so an interrupted or tampered download leaves the store
 * unchanged.
 */
export async function downloadModelAsset(
  options: DownloadModelAssetOptions,
): Promise<DownloadedModelAsset> {
  if (!options.store.capabilities.writable) {
    throw new StorageError('downloadModelAsset requires a writable artifact store', 'write-failed');
  }
  const location = await options.download();
  const bytes = await options.readBytes(location);
  const digest = digestOf(bytes);
  if (options.expectedRef && options.expectedRef.digest.toLowerCase() !== digest) {
    throw new StorageError(
      `downloaded model asset digest mismatch: ${digest} !== ${options.expectedRef.digest}`,
      'corrupt',
    );
  }
  const receipt = await options.store.put(options.namespace, bytes);
  return { location, ref: receipt.ref, bytes: bytes.length };
}

/** Verify already-downloaded bytes against a ref without writing them. */
export function verifyModelAssetBytes(bytes: Uint8Array, ref: ArtifactRef): boolean {
  return digestOf(bytes).toLowerCase() === ref.digest.toLowerCase();
}
