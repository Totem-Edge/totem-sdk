/** Hyperbee-backed read-mostly `DistributedIndex` (RFC-057 Phase 1). */

import { bytesToHex, sha3_256 } from '@totemsdk/core';
import { decodeReplicationRecord, encodeReplicationRecord, type DatasetDescriptor, type DistributedIndex, type ReplicationStatus } from '@totemsdk/replication';

export interface HyperbeeIndexOptions {
  storagePath: string;
  /** Optional root key for a read replica. */
  key?: Buffer;
  descriptor: DatasetDescriptor;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Hypercore?: new (path: string, key?: Buffer) => any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Hyperbee?: new (core: unknown, opts: object) => any;
}

export class HyperbeeDistributedIndex implements DistributedIndex {
  private readonly descriptor: DatasetDescriptor;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly bee: any;
  private lastUpdateAt?: number;

  private constructor(descriptor: DatasetDescriptor, bee: unknown) {
    this.descriptor = descriptor;
    this.bee = bee;
  }

  static async open(options: HyperbeeIndexOptions): Promise<HyperbeeDistributedIndex> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let HypercoreCtor: any = options.Hypercore;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let HyperbeeCtor: any = options.Hyperbee;
    if (!HypercoreCtor) {
      const mod = await import('hypercore' as string) as { default: new (path: string) => unknown };
      HypercoreCtor = mod.default;
    }
    if (!HyperbeeCtor) {
      const mod = await import('hyperbee' as string) as { default: new (core: unknown, opts: object) => unknown };
      HyperbeeCtor = mod.default;
    }
    const core = new HypercoreCtor(options.storagePath, options.key);
    const bee = new HyperbeeCtor(core, { keyEncoding: 'utf-8', valueEncoding: 'binary' });
    await bee.ready?.();
    return new HyperbeeDistributedIndex(options.descriptor, bee);
  }

  async get(key: string): Promise<unknown | null> {
    const entry = await this.bee.get(key);
    if (!entry) return null;
    return decodeReplicationRecord(this.descriptor, entry.value as Uint8Array);
  }

  async *list(prefix = ''): AsyncIterable<{ key: string; value: unknown }> {
    for await (const entry of this.bee.createReadStream({ gte: prefix, lt: prefix ? `${prefix}\xff` : undefined })) {
      yield { key: entry.key as string, value: decodeReplicationRecord(this.descriptor, entry.value as Uint8Array) };
    }
  }

  /** Producer-side write (the read contract does not expose it). */
  async put(key: string, value: unknown): Promise<void> {
    await this.bee.put(key, Buffer.from(encodeReplicationRecord(this.descriptor, value)));
    this.lastUpdateAt = Date.now();
  }

  status(): ReplicationStatus {
    const length = Number(this.bee.feed?.length ?? 0);
    return {
      connectedPeers: Number(this.bee.feed?.peers?.length ?? 0),
      localHead: length > 0 ? `bee:${length}:${bytesToHex(sha3_256(new TextEncoder().encode(String(length))))}` : null,
      observedHeads: [],
      syncing: false,
      ...(this.lastUpdateAt !== undefined ? { lastUpdateAt: this.lastUpdateAt } : {}),
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  get raw(): any {
    return this.bee;
  }

  async close(): Promise<void> {
    await this.bee.close?.();
  }
}
