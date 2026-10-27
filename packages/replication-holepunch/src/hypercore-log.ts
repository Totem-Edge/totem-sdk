/**
 * Hypercore-backed `ReplicatedLog` (RFC-057 Phase 1).
 *
 * Cursors are `hc:<blockLength>`; the head is `hc:<length>:<sha3(lastBlock)>`.
 * `append()` resolves after the local Hypercore append, never after remote
 * replication.
 */

import { bytesToHex, sha3_256 } from '@totemsdk/core';
import { decodeReplicationRecord, encodeReplicationRecord, type DatasetDescriptor, type ReplicatedLog, type ReplicationStatus } from '@totemsdk/replication';

export interface HypercoreLogOptions {
  storagePath: string;
  /** Optional root key for a read replica. */
  key?: Buffer;
  descriptor: DatasetDescriptor;
  /** Inject a Hypercore constructor (tests) instead of importing it. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Hypercore?: new (path: string, key?: Buffer) => any;
}

export class HypercoreReplicatedLog<T> implements ReplicatedLog<T> {
  private readonly descriptor: DatasetDescriptor;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly core: any;
  private lastUpdateAt?: number;

  private constructor(descriptor: DatasetDescriptor, core: unknown) {
    this.descriptor = descriptor;
    this.core = core;
  }

  static async open<T>(options: HypercoreLogOptions): Promise<HypercoreReplicatedLog<T>> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let Ctor: any = options.Hypercore;
    if (!Ctor) {
      const mod = await import('hypercore' as string) as { default: new (path: string) => unknown };
      Ctor = mod.default;
    }
    const core = new Ctor(options.storagePath, options.key);
    await core.ready?.();
    return new HypercoreReplicatedLog<T>(options.descriptor, core);
  }

  async append(record: T): Promise<{ length: number; head: string }> {
    const bytes = encodeReplicationRecord(this.descriptor, record);
    await this.core.append(bytes);
    this.lastUpdateAt = Date.now();
    const length = Number(this.core.length);
    const block: Uint8Array = await this.core.get(length - 1);
    return { length, head: `hc:${length}:${bytesToHex(sha3_256(block))}` };
  }

  async *readSince(cursor?: string): AsyncIterable<{ cursor: string; record: T }> {
    const start = cursor ? parseCursor(cursor) : 0;
    const length = Number(this.core.length);
    for (let i = start; i < length; i += 1) {
      const block: Uint8Array = await this.core.get(i);
      yield { cursor: `hc:${i + 1}`, record: decodeReplicationRecord<T>(this.descriptor, block) };
    }
  }

  status(): ReplicationStatus {
    const length = Number(this.core.length);
    return {
      connectedPeers: Number(this.core.peers?.length ?? 0),
      localHead: length > 0 ? `hc:${length}` : null,
      observedHeads: [],
      syncing: false,
      ...(this.lastUpdateAt !== undefined ? { lastUpdateAt: this.lastUpdateAt } : {}),
    };
  }

  /** Raw Hypercore for replication plumbing/tests. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  get raw(): any {
    return this.core;
  }

  async close(): Promise<void> {
    await this.core.close?.();
  }
}

function parseCursor(cursor: string): number {
  const match = /^hc:(\d+)$/.exec(cursor);
  if (!match) throw new Error(`replication-holepunch: invalid cursor ${JSON.stringify(cursor)}`);
  return Number(match[1]);
}
