/**
 * RFC-057 Phase 4 — first production consumers.
 *
 * Thin, authority-preserving facades over the replicated log/index/artifact
 * primitives: device event histories, replicated manifests and agent receipts.
 * None of these replace local CAS/authoritative state.
 */

import { sha3_256, toHex } from '@totemsdk/core';
import type { DistributedIndex, ReplicatedLog } from '@totemsdk/replication';
import type { ArtifactStore } from '@totemsdk/storage/artifacts';
import { StorageError } from '@totemsdk/storage/errors';

export interface DeviceEvent {
  readonly eventId: string;
  readonly deviceId: string;
  readonly occurredAt: number;
  readonly kind: string;
  readonly payload?: Readonly<Record<string, unknown>>;
}

export class DeviceEventHistory {
  constructor(private readonly log: ReplicatedLog<DeviceEvent>) {}

  async append(event: DeviceEvent): Promise<{ length: number; head: string }> {
    if (!event.eventId || !event.deviceId) throw new Error('device event requires eventId and deviceId');
    if (!Number.isFinite(event.occurredAt) || event.occurredAt < 0) {
      throw new Error('device event requires a non-negative occurredAt');
    }
    return this.log.append(event);
  }

  readSince(cursor?: string): AsyncIterable<{ cursor: string; record: DeviceEvent }> {
    return this.log.readSince(cursor);
  }

  status() {
    return this.log.status();
  }

  close(): Promise<void> {
    return this.log.close();
  }
}

export interface ReplicatedManifest<T = unknown> {
  readonly manifestId: string;
  readonly version: number;
  readonly body: T;
  readonly digest: string;
}

export interface ManifestIndexPort {
  get(key: string): Promise<unknown | null>;
  put(key: string, value: unknown): Promise<void>;
}

export class ReplicatedManifestStore {
  constructor(private readonly index: ManifestIndexPort) {}

  async publish<T>(manifestId: string, version: number, body: T): Promise<ReplicatedManifest<T>> {
    if (!manifestId) throw new Error('manifestId is required');
    if (!Number.isInteger(version) || version < 1) throw new Error('manifest version must be positive');
    const digest = toHex(sha3_256(new TextEncoder().encode(JSON.stringify(body))));
    const manifest: ReplicatedManifest<T> = { manifestId, version, body, digest };
    await this.index.put(`manifest:${manifestId}`, manifest);
    return manifest;
  }

  async get<T>(manifestId: string): Promise<ReplicatedManifest<T> | null> {
    const value = await this.index.get(`manifest:${manifestId}`);
    if (!value) return null;
    const manifest = value as ReplicatedManifest<T>;
    const digest = toHex(sha3_256(new TextEncoder().encode(JSON.stringify(manifest.body))));
    if (digest !== manifest.digest) {
      throw new StorageError(`manifest digest mismatch for "${manifestId}"`, 'corrupt');
    }
    return manifest;
  }
}

export interface AgentReceipt {
  readonly receiptId: string;
  readonly actionId: string;
  readonly agentId: string;
  readonly issuedAt: number;
  readonly digest: string;
  readonly payload?: Readonly<Record<string, unknown>>;
}

export class AgentReceiptLog {
  constructor(private readonly log: ReplicatedLog<AgentReceipt>) {}

  async append(receipt: AgentReceipt): Promise<{ length: number; head: string }> {
    if (!receipt.receiptId || !receipt.actionId || !receipt.agentId) {
      throw new Error('agent receipt requires receiptId, actionId and agentId');
    }
    return this.log.append(receipt);
  }

  readSince(cursor?: string): AsyncIterable<{ cursor: string; record: AgentReceipt }> {
    return this.log.readSince(cursor);
  }

  status() {
    return this.log.status();
  }

  close(): Promise<void> {
    return this.log.close();
  }
}

/** Optional helper for keeping large manifest bodies in the artifact store. */
export async function publishManifestArtifact(
  artifacts: ArtifactStore,
  namespace: string,
  body: Uint8Array,
): Promise<{ digest: string; reference: string }> {
  const receipt = await artifacts.put(namespace, body);
  return { digest: receipt.ref.digest, reference: `${receipt.ref.namespace}:${receipt.ref.digest}` };
}
