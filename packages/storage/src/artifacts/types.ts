/**
 * @module @totemsdk/storage/artifacts/types
 *
 * Artifact-boundary type definitions for the pluggable `ArtifactStoreBackend`
 * port.
 *
 * Artifacts are content-addressed (digest = committed hash) and the backend is a
 * byte-mover with declared capabilities — deliberately not a KV store, so it can
 * never shadow the transactional `StorageAdapter` contract. `put` returns
 * `ok | not-found | corrupt | unavailable`. Mutable/GC/tombstone/retention logic
 * stays local; remote stores just move and verify bytes.
 */

import type { WriteAckMode } from '../types.js';

export type ArtifactHashAlgorithm = 'sha3-256';
export const ARTIFACT_DEFAULT_ALGORITHM: ArtifactHashAlgorithm = 'sha3-256';

export interface ArtifactRef {
  readonly namespace: string;
  readonly algorithm: ArtifactHashAlgorithm;
  readonly digest: string;
}

export function artifactRefId(ref: ArtifactRef): string {
  return `${ref.namespace}:${ref.algorithm}:${ref.digest}`;
}

export interface ArtifactBackendCapabilities {
  readonly writable: boolean;
  readonly acknowledge: WriteAckMode;
  readonly atomic: boolean;
  readonly retention: 'fixed' | 'managed' | 'none';
  readonly offlineReadable: boolean;
}

export interface PutOptions {
  readonly metadata?: Readonly<Record<string, string>>;
  readonly retentionMs?: number;
}

export interface PutReceipt {
  readonly ref: ArtifactRef;
  readonly size: number;
  readonly acknowledge: WriteAckMode;
}

export type ArtifactReadStatus = 'ok' | 'not-found' | 'corrupt' | 'unavailable';

export interface ArtifactRead {
  readonly status: ArtifactReadStatus;
  readonly bytes?: Uint8Array;
  readonly message?: string;
}

export interface ArtifactStoreBackend {
  readonly capabilities: ArtifactBackendCapabilities;
  put(ref: ArtifactRef, bytes: Uint8Array, options?: PutOptions): Promise<PutReceipt>;
  get(ref: ArtifactRef): Promise<ArtifactRead>;
  delete?(ref: ArtifactRef): Promise<void>;
}

export interface ArtifactIndexEntry {
  readonly id: string;
  readonly ref: ArtifactRef;
  readonly size: number;
  readonly createdAt: number;
  readonly owner?: string;
  readonly retentionMs?: number;
  readonly tombstone?: boolean;
}