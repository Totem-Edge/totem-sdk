/**
 * Durable provider-bond/claim registry (RFC-007 G6).
 *
 * Drop-in replacement for `MemoryProviderBondStore` backed by a storage
 * adapter instead of a heap object: the authoritative `ProviderBondRegistryState`
 * is a single revision-CAS record (RFC-007 §4.2) so concurrent registry
 * transitions never lose an update, reopen preserves every bond/claim/probe/
 * incident/score record, and corruption is surfaced — never treated as absence.
 */

import type {
  ProviderBondManifest,
  ProviderBondRegistryState,
  BondProofRef,
  ProbeResult,
  IncidentRecord,
  ProviderScore,
} from './types.js';
import {
  createEmptyProviderBondRegistryState,
  registerProvider,
  updateProviderManifest,
  attachBondProof,
  recordProviderProbe,
  recordProviderIncident,
  updateProviderScore,
  listProviders,
  getProvider,
  listProvidersByServiceType,
  listRiskyProviders,
  listOfflineProviders,
} from './registry.js';
import {
  createRevisionedSnapshotStore,
  type RevisionedSnapshotStore,
} from '@totemsdk/storage/snapshot';
import type { StorageAdapterWithCapabilities, CasStore, WriteAckMode } from '@totemsdk/storage/types';
import { StorageError } from '@totemsdk/storage/errors';

const DEFAULT_NAMESPACE = 'totem_bond:v1:';

export interface DurableProviderBondStoreOptions {
  /** Key namespace prefix; default `totem_bond:v1:`. */
  readonly namespace?: string;
  /**
   * Required write acknowledgment; default `durably-acknowledged`. Pass
   * `volatile` only for tests/scratch adapters (e.g. `MemoryStore`).
   */
  readonly requireAckMode?: WriteAckMode;
}

export interface DurableProviderBondStore {
  registerProvider(manifest: ProviderBondManifest): Promise<void>;
  updateProviderManifest(manifest: ProviderBondManifest): Promise<void>;
  attachBondProof(providerId: string, proof: BondProofRef): Promise<void>;
  recordProbe(providerId: string, probe: ProbeResult): Promise<void>;
  recordIncident(providerId: string, incident: IncidentRecord): Promise<void>;
  updateScore(providerId: string, score: ProviderScore): Promise<void>;
  listProviders(): Promise<ProviderBondManifest[]>;
  getProvider(providerId: string): Promise<ProviderBondManifest | undefined>;
  listProvidersByServiceType(serviceType: string): Promise<ProviderBondManifest[]>;
  listRiskyProviders(threshold: number): Promise<ProviderBondManifest[]>;
  listOfflineProviders(maxHeartbeatAgeMs: number, now: number): Promise<ProviderBondManifest[]>;
  getSnapshot(): Promise<ProviderBondRegistryState>;
  /** Current registry transition counter (0 before the first write). */
  getRevision(): Promise<number>;
  /** True once any registry record has been persisted. */
  hasState(): Promise<boolean>;
}

function assertRegistryState(state: ProviderBondRegistryState): void {
  if (typeof state !== 'object' || state === null || Array.isArray(state)) {
    throw new StorageError('bond registry state is not an object', 'corrupt');
  }
  for (const section of ['providers', 'bondProofs', 'probes', 'incidents', 'scores'] as const) {
    const value = (state as unknown as Record<string, unknown>)[section];
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new StorageError(`bond registry state is missing section "${section}"`, 'corrupt');
    }
  }
}

function cloneSnapshot(state: ProviderBondRegistryState): ProviderBondRegistryState {
  // Preserve MemoryProviderBondStore.getSnapshot semantics: bigint → string
  // JSON round-trip, a deep clone callers may mutate freely.
  return JSON.parse(JSON.stringify(state, (_, v) => (typeof v === 'bigint' ? v.toString() : v)));
}

export function createDurableProviderBondStore(
  adapter: StorageAdapterWithCapabilities & CasStore,
  options: DurableProviderBondStoreOptions = {},
): DurableProviderBondStore {
  const snapshots: RevisionedSnapshotStore<ProviderBondRegistryState> = createRevisionedSnapshotStore(
    adapter,
    {
      namespace: options.namespace ?? DEFAULT_NAMESPACE,
      requireAckMode: options.requireAckMode,
      empty: () => createEmptyProviderBondRegistryState(),
      validate: assertRegistryState,
    },
  );

  async function mutate(fn: (state: ProviderBondRegistryState) => ProviderBondRegistryState): Promise<void> {
    await snapshots.mutate(fn);
  }

  return {
    async registerProvider(manifest: ProviderBondManifest): Promise<void> {
      await mutate((state) => registerProvider(state, manifest));
    },
    async updateProviderManifest(manifest: ProviderBondManifest): Promise<void> {
      await mutate((state) => updateProviderManifest(state, manifest));
    },
    async attachBondProof(providerId: string, proof: BondProofRef): Promise<void> {
      await mutate((state) => attachBondProof(state, providerId, proof));
    },
    async recordProbe(providerId: string, probe: ProbeResult): Promise<void> {
      await mutate((state) => recordProviderProbe(state, providerId, probe));
    },
    async recordIncident(providerId: string, incident: IncidentRecord): Promise<void> {
      await mutate((state) => recordProviderIncident(state, providerId, incident));
    },
    async updateScore(providerId: string, score: ProviderScore): Promise<void> {
      await mutate((state) => updateProviderScore(state, providerId, score));
    },
    async listProviders(): Promise<ProviderBondManifest[]> {
      return listProviders(await snapshots.load());
    },
    async getProvider(providerId: string): Promise<ProviderBondManifest | undefined> {
      return getProvider(await snapshots.load(), providerId);
    },
    async listProvidersByServiceType(serviceType: string): Promise<ProviderBondManifest[]> {
      return listProvidersByServiceType(await snapshots.load(), serviceType);
    },
    async listRiskyProviders(threshold: number): Promise<ProviderBondManifest[]> {
      return listRiskyProviders(await snapshots.load(), threshold);
    },
    async listOfflineProviders(maxHeartbeatAgeMs: number, now: number): Promise<ProviderBondManifest[]> {
      return listOfflineProviders(await snapshots.load(), maxHeartbeatAgeMs, now);
    },
    async getSnapshot(): Promise<ProviderBondRegistryState> {
      return cloneSnapshot(await snapshots.load());
    },
    getRevision: () => snapshots.getRevision(),
    hasState: () => snapshots.hasState(),
  };
}