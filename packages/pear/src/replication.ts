/**
 * RFC-057 — Pear/Bare replication factories.
 *
 * Kept behind the `@totemsdk/pear/replication` subpath so the main Pear entry
 * does not load Hypercore/Hyperbee/Hyperdrive/Autobase. Bare apps opt in.
 */

import type {
  DatasetDescriptor,
  DistributedIndex,
  ReplicatedLog,
} from '@totemsdk/replication';

export interface PearReplicatedLogOptions {
  storagePath: string;
  descriptor: DatasetDescriptor;
  key?: Buffer;
}

export async function openPearReplicatedLog<T>(
  options: PearReplicatedLogOptions,
): Promise<ReplicatedLog<T>> {
  const mod = await import('@totemsdk/replication-holepunch');
  return mod.HypercoreReplicatedLog.open<T>(options);
}

export async function openPearReplicatedIndex(
  options: PearReplicatedLogOptions,
): Promise<DistributedIndex> {
  const mod = await import('@totemsdk/replication-holepunch');
  return mod.HyperbeeDistributedIndex.open(options);
}

export async function openPearArtifactBackend(options: {
  storagePath: string;
}): Promise<import('@totemsdk/storage/artifacts').ArtifactStoreBackend> {
  const mod = await import('@totemsdk/replication-holepunch');
  return mod.HyperdriveArtifactBackend.open(options);
}
