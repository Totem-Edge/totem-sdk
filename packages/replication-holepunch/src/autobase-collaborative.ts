/**
 * RFC-057 Phase 3 — Autobase collaborative state.
 *
 * A deterministic reducer is materialised through a Hypercore view. Autobase
 * linearises writer nodes; this adapter enforces dataset version, writer
 * admission and owner-only writer-set changes. The view stores only applied
 * operations, so every peer that has the same linearised prefix produces the
 * same state.
 */

import Autobase from 'autobase';
import Corestore from 'corestore';
import type { CollaborativeStore, ReplicationStatus } from '@totemsdk/replication';
import { sha3_256, toHex } from '@totemsdk/core';

const CONTROL_ADD_WRITER = '__totem_add_writer';

interface ViewEnvelope<Op> {
  /** Writer core key (hex) that produced the operation. */
  w: string;
  /** Op payload, or a control marker. */
  o: Op | { type: typeof CONTROL_ADD_WRITER; key: string };
  v: number;
}

export interface AutobaseReducer<Op, State> {
  initialState(): State;
  reduce(state: State, op: Op): State;
}

export interface AutobaseCollaborativeOptions<Op, State> {
  storagePath: string;
  datasetVersion: number;
  reducer: AutobaseReducer<Op, State>;
  /** Existing base key; omitted creates a new base. */
  bootstrapKey?: Uint8Array;
  /** Writer allowed to add/remove writers; defaults to the local key for a new base. */
  ownerKey?: string;
  /** Optional allow-list applied to every writer node. */
  isWriterAllowed?: (writerKey: string) => boolean;
  /** Optional live peer count provider. */
  connectedPeers?: () => number;
  /** Close the injected Corestore (default true). */
  ownsStore?: boolean;
}

interface OpenedBase<Op, State> {
  store: InstanceType<typeof Corestore>;
  base: any;
}

function hex(value: Uint8Array | string): string {
  return typeof value === 'string' ? value : Buffer.from(value).toString('hex');
}

export class AutobaseCollaborativeStore<Op, State>
  implements CollaborativeStore<Op, State> {
  private readonly base: any;
  private readonly store: InstanceType<typeof Corestore>;
  private readonly reducer: AutobaseReducer<Op, State>;
  private readonly datasetVersion: number;
  private readonly ownerKey: string;
  private readonly isWriterAllowed: (writerKey: string) => boolean;
  private readonly connectedPeers: () => number;
  private readonly ownsStore: boolean;
  private closed = false;

  private constructor(
    opened: OpenedBase<Op, State>,
    options: AutobaseCollaborativeOptions<Op, State>,
    ownerKey: string,
  ) {
    this.base = opened.base;
    this.store = opened.store;
    this.reducer = options.reducer;
    this.datasetVersion = options.datasetVersion;
    this.ownerKey = ownerKey;
    this.isWriterAllowed = options.isWriterAllowed ?? (() => true);
    this.connectedPeers = options.connectedPeers ?? (() => 0);
    this.ownsStore = options.ownsStore ?? true;
  }

  static async open<Op, State>(
    options: AutobaseCollaborativeOptions<Op, State>,
  ): Promise<AutobaseCollaborativeStore<Op, State>> {
    const store = new Corestore(options.storagePath);
    const ownerKey = options.ownerKey?.toLowerCase();
    let owner: string | undefined = ownerKey;

    const reducer = options.reducer;
    const datasetVersion = options.datasetVersion;

    const base = new Autobase(store, options.bootstrapKey ?? null, {
      valueEncoding: 'json',
      ackInterval: 100,
      open: (corestore: any) =>
        corestore.get({ name: 'totem-collab-ops', valueEncoding: 'json' }),
      async apply(nodes: any[], view: any, host: any): Promise<void> {
        for (const node of nodes) {
          const value = node.value;
          if (!value || typeof value !== 'object') continue;
          const writer = hex(node.from.key);
          if (value.o?.type === CONTROL_ADD_WRITER) {
            if (writer !== (owner ?? hex(base.local.key))) continue;
            await host.addWriter(Buffer.from(value.o.key, 'hex'), { indexer: true });
            continue;
          }
          if (options.isWriterAllowed && !options.isWriterAllowed(writer)) continue;
          await view.append(JSON.stringify({ w: writer, o: value.o, v: datasetVersion }));
        }
      },
    });
    await base.ready();
    owner = owner ?? hex(base.local.key);

    return new AutobaseCollaborativeStore<Op, State>(
      { store, base },
      options,
      owner,
    );
  }

  get baseKey(): string {
    return hex(this.base.key);
  }

  get localKey(): string {
    return hex(this.base.local.key);
  }

  get writable(): boolean {
    return Boolean(this.base.writable);
  }

  /** Replication stream for a Corestore connection. */
  replicate(isInitiator = false): any {
    return this.base.replicate(isInitiator);
  }

  /** Owner-only writer admission; the control op itself is not materialised. */
  async addWriter(writerKey: string): Promise<void> {
    this.assertOpen();
    if (hex(this.base.local.key) !== this.ownerKey) {
      throw new Error('only the owner writer may add writers');
    }
    await this.base.append({
      o: { type: CONTROL_ADD_WRITER, key: writerKey.toLowerCase() },
    });
    await this.base.update();
  }

  async propose(operation: Op): Promise<{ id: string; status: 'queued' | 'applied' }> {
    this.assertOpen();
    if (!this.base.writable) {
      throw new Error('writer is not admitted to this collaborative dataset');
    }
    const id = toHex(sha3_256(
      new TextEncoder().encode(`${this.baseKey}:${this.base.length}:${JSON.stringify(operation)}`),
    ));
    await this.base.append({ o: operation });
    await this.base.update();
    return { id, status: 'applied' };
  }

  async readView(): Promise<{ state: State; revision: string; complete: boolean }> {
    this.assertOpen();
    await this.base.update();
    if (this.base.isIndexer && this.base.signedLength !== this.base.length) {
      await this.base.ack();
      await this.base.update();
    }
    const view = this.base.view;
    let state = this.reducer.initialState();
    for (let i = 0; i < view.length; i += 1) {
      const raw = await view.get(i);
      const envelope = (typeof raw === 'string' ? JSON.parse(raw) : raw) as ViewEnvelope<Op> | null;
      if (!envelope || typeof envelope !== 'object' || envelope.v !== this.datasetVersion) {
        continue;
      }
      state = this.reducer.reduce(state, envelope.o as Op);
    }
    const revision = toHex(sha3_256(new TextEncoder().encode(
      `${this.baseKey}:${view.length}:${JSON.stringify(state)}`,
    )));
    return {
      state,
      revision,
      complete: !this.base.paused && this.base.signedLength === this.base.length,
    };
  }

  status(): ReplicationStatus {
    const heads = typeof this.base.heads === 'function' ? this.base.heads() : [];
    return {
      connectedPeers: this.connectedPeers(),
      localHead: `${this.baseKey}:${this.base.length}`,
      observedHeads: heads
        .filter((node: any) => node && node.from && node.from.key)
        .map((node: any) => ({
          peerId: hex(node.from.key),
          head: `${hex(node.from.key)}:${node.length}`,
        })),
      syncing: this.base.signedLength !== this.base.length,
    };
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    await this.base.close();
    if (this.ownsStore) await this.store.close();
  }

  private assertOpen(): void {
    if (this.closed) throw new Error('collaborative store is closed');
  }
}
