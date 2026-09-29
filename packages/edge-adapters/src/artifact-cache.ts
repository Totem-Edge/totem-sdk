/**
 * edge-adapters/artifact-cache.ts — RFC-007 Amendment A, phase A1.
 *
 * The first consumer of the Edge persistence injection point (`PersistencePorts`).
 * A scoped, content-addressed artifact cache over the injected `storage` (KV
 * retention index) and `artifacts` (byte store) surfaces.
 *
 * Typed structurally against `@totemsdk/storage` — this module must NOT import
 * `@totemsdk/edge`, so it carries no Edge runtime dependency.
 *
 * Guarantees:
 *   - `assertPersistence()` validates surfaces/capabilities at construction.
 *   - Scope is collision-control only (namespaces); authorization stays above.
 *   - Retrieval re-verifies digests via `ArtifactStore.get` (`corrupt` vs
 *     `not-found` are never conflated).
 *   - Retention/expiry entries survive restart when the injected storage is durable.
 */

import {
  ArtifactStore,
  StorageError,
  artifactRefId,
  assertPersistence,
  createScopedStorage,
} from '@totemsdk/storage';
import type {
  ArtifactBackendCapabilities,
  ArtifactRead,
  ArtifactRef,
  EffectivePersistence,
  PersistencePorts,
  PersistenceRequirement,
  ScopedStorage,
  StorageScope,
} from '@totemsdk/storage';

/**
 * Per-object cache policy. Deliberately does NOT reuse the `retention:
 * 'fixed'|'managed'|'none'` vocabulary: that is a BACKEND capability, not a
 * per-object request.
 */
export interface ArtifactCacheRetentionPolicy {
  readonly ttlMs?: number;
  readonly invalidateOnExpiry?: boolean;
}

export interface EdgeArtifactCache {
  readonly capabilities: ArtifactBackendCapabilities;
  /** Reported after assertPersistence(); callers must never assume durability. */
  readonly effective: EffectivePersistence;
  put(scope: StorageScope, bytes: Uint8Array, policy?: ArtifactCacheRetentionPolicy): Promise<ArtifactRef>;
  get(scope: StorageScope, ref: ArtifactRef, policy?: ArtifactCacheRetentionPolicy): Promise<ArtifactRead>;
  invalidate(scope: StorageScope, ref: ArtifactRef): Promise<void>;
}

interface RetentionEntry {
  readonly ref: ArtifactRef;
  readonly size: number;
  readonly createdAt: number;
  readonly expiresAt?: number;
}

/** Scope-derived artifact namespace: separate scopes never alias the same blob. */
function scopeNamespace(scope: StorageScope): string {
  const parts = [scope.principal, scope.adapter, scope.purpose, scope.domain]
    .filter((p): p is string => typeof p === 'string' && p.length > 0)
    .map((p) => encodeURIComponent(p));
  return `edge-cache:${parts.join('/')}`;
}

export function createEdgeArtifactCache(
  ports: PersistencePorts,
  requirement: PersistenceRequirement = { durable: false },
  policy: ArtifactCacheRetentionPolicy = {},
): EdgeArtifactCache {
  const label = 'edge-artifact-cache';
  // The cache always needs both surfaces and a deletable artifact backend.
  const effective = assertPersistence(
    ports,
    { ...requirement, needsArtifacts: true, needsArtifactDelete: true },
    label,
  );

  const storage = ports.storage;
  const artifacts: ArtifactStore | undefined = ports.artifacts;
  if (!storage) {
    throw new StorageError(`${label}: a storage index is required for retention/expiry`, 'unavailable');
  }
  if (!artifacts) {
    throw new StorageError(`${label}: an artifact store is required`, 'unavailable');
  }

  const defaultTtlMs = policy.ttlMs;
  const defaultInvalidateOnExpiry = policy.invalidateOnExpiry ?? false;
  const now = () => Date.now();
  const scoped = (scope: StorageScope): ScopedStorage => createScopedStorage(storage, scope);

  return {
    capabilities: artifacts.capabilities,
    effective,

    async put(scope, bytes, putPolicy) {
      const ttlMs = putPolicy?.ttlMs ?? defaultTtlMs;
      const receipt = await artifacts.put(scopeNamespace(scope), bytes, {
        ...(ttlMs !== undefined ? { retentionMs: ttlMs } : {}),
      });
      const entry: RetentionEntry = {
        ref: receipt.ref,
        size: receipt.size,
        createdAt: now(),
        ...(ttlMs !== undefined ? { expiresAt: now() + ttlMs } : {}),
      };
      await scoped(scope).set(artifactRefId(receipt.ref), entry);
      return receipt.ref;
    },

    async get(scope, ref, getPolicy) {
      const entry = await scoped(scope).get<RetentionEntry>(artifactRefId(ref));
      if (!entry) {
        // Not known to this scope — never fall through to the raw backend.
        return { status: 'not-found' };
      }
      if (entry.expiresAt !== undefined && now() > entry.expiresAt) {
        const invalidate = getPolicy?.invalidateOnExpiry ?? defaultInvalidateOnExpiry;
        if (invalidate) await this.invalidate(scope, ref);
        return { status: 'not-found' };
      }
      // Digest re-verification + corrupt/not-found taxonomy live in ArtifactStore.
      return artifacts.get(ref);
    },

    async invalidate(scope, ref) {
      await artifacts.delete(ref);
      await scoped(scope).remove(artifactRefId(ref));
    },
  };
}
