/** Runtime-neutral distributed-storage contracts. */

export interface ObservedHead {
  peerId: string;
  head: string;
  signature?: string;
}

export interface ReplicationStatus {
  readonly connectedPeers: number;
  readonly localHead: string | null;
  readonly observedHeads: ReadonlyArray<ObservedHead>;
  readonly syncing: boolean;
  readonly lastUpdateAt?: number;
}

export interface DistributedCapabilities {
  readonly model: 'single-writer' | 'multi-writer' | 'read-replica';
  readonly historicalReads: boolean;
  readonly sparseReplication: boolean;
  readonly encrypted: boolean;
  readonly authenticatedWriters: boolean;
}

export interface ReplicatedLog<T> {
  append(record: T): Promise<{ length: number; head: string }>;
  readSince(cursor?: string): AsyncIterable<{ cursor: string; record: T }>;
  status(): ReplicationStatus;
  close(): Promise<void>;
}

export interface DistributedIndex {
  get(key: string): Promise<unknown | null>;
  list(prefix?: string): AsyncIterable<{ key: string; value: unknown }>;
  status(): ReplicationStatus;
  close(): Promise<void>;
}

export interface CollaborativeStore<Op, State> {
  propose(operation: Op): Promise<{ id: string; status: 'queued' | 'applied' }>;
  readView(): Promise<{ state: State; revision: string; complete: boolean }>;
  status(): ReplicationStatus;
  close(): Promise<void>;
}

export interface DistributedFileStore {
  get(path: string): Promise<Uint8Array | null>;
  put(path: string, data: Uint8Array): Promise<void>;
  status(): ReplicationStatus;
  close(): Promise<void>;
}
