/**
 * V0 spend-state authority — a durable, operator-signed epoch journal.
 *
 * One authority per pool. It enforces:
 *   - monotonic epochs;
 *   - one root per epoch;
 *   - no receipt may spend an input already recorded;
 *   - a signed epoch is persisted before publication, so a crash can be
 *     recovered and the pending epoch republished without re-signing.
 *
 * The journal is the authority; it is not a second counter for the pool's
 * value. `recover()` reports epochs that are durable but not yet marked
 * published.
 */

import { createJournal, type Journal } from '@totemsdk/storage/journal';
import type { CasStore, StorageAdapterWithCapabilities } from '@totemsdk/storage/types';
import type { OmniaVtxoOperator, VtxoOperatorReceipt } from './types.js';
import { computeEpochCommitmentBytes } from './commitment.js';
import { verifyVtxoReceipt } from './receipt.js';

export interface EpochRecord {
  kind: 'epoch';
  poolId: string;
  epoch: number;
  root: string;
  receiptId: string;
  inputIds: string[];
  outputIds: string[];
  at: number;
  signature: string;
}

export interface EpochPublished {
  kind: 'published';
  poolId: string;
  epoch: number;
  at: number;
}

export type EpochEvent = EpochRecord | EpochPublished;

export interface EpochAuthorityOptions {
  poolId: string;
  journal: Journal<EpochEvent>;
  operator: OmniaVtxoOperator;
  now?: () => number;
}

export interface EpochAuthorityState {
  epoch: number;
  root: string;
  spentInputIds: Set<string>;
  recordedReceiptIds: Set<string>;
}

export interface EpochRecovery {
  epoch: number;
  root: string;
  publishedEpoch: number;
  pending: EpochRecord[];
}

function replay(events: readonly EpochEvent[], poolId: string): EpochAuthorityState & { publishedEpoch: number } {
  const epochs = events.filter((e): e is EpochRecord => e.kind === 'epoch' && e.poolId === poolId);
  const published = events.filter((e): e is EpochPublished => e.kind === 'published' && e.poolId === poolId);
  const latest = epochs.reduce<EpochRecord | undefined>(
    (best, e) => (!best || e.epoch > best.epoch ? e : best),
    undefined,
  );
  const spent = new Set<string>();
  const receiptIds = new Set<string>();
  for (const e of epochs) {
    for (const id of e.inputIds) spent.add(id);
    receiptIds.add(e.receiptId);
  }
  return {
    epoch: latest?.epoch ?? 0,
    root: latest?.root ?? '',
    spentInputIds: spent,
    recordedReceiptIds: receiptIds,
    publishedEpoch: published.reduce((max, p) => Math.max(max, p.epoch), 0),
  };
}

export class EpochAuthority {
  private readonly poolId: string;
  private readonly journal: Journal<EpochEvent>;
  private readonly operator: OmniaVtxoOperator;
  private readonly now: () => number;

  constructor(options: EpochAuthorityOptions) {
    this.poolId = options.poolId;
    this.journal = options.journal;
    this.operator = options.operator;
    this.now = options.now ?? (() => Date.now());
  }

  private async events(): Promise<EpochEvent[]> {
    return (await this.journal.read()).map((entry) => entry.record);
  }

  async current(): Promise<EpochAuthorityState & { publishedEpoch: number }> {
    return replay(await this.events(), this.poolId);
  }

  /**
   * Record a co-signed receipt. The operator signs the epoch commitment after
   * verifying the receipt, so the durable record cannot be forged later.
   */
  async append(receipt: VtxoOperatorReceipt, root: string): Promise<EpochRecord> {
    if (receipt.poolId !== this.poolId) throw new Error('epoch authority: receipt pool mismatch');
    if (!(await verifyVtxoReceipt(this.operator, receipt, root))) {
      throw new Error('epoch authority: receipt signature is invalid');
    }
    const state = await this.current();
    if (receipt.epoch < state.epoch) {
      throw new Error(`epoch authority: stale receipt epoch ${receipt.epoch} < ${state.epoch}`);
    }
    if (receipt.epoch === state.epoch && root !== state.root) {
      throw new Error('epoch authority: conflicting root for the current epoch');
    }
    if (receipt.epoch > state.epoch + 1) {
      throw new Error(`epoch authority: epoch gap ${state.epoch} → ${receipt.epoch}`);
    }
    for (const inputId of receipt.inputIds) {
      if (state.spentInputIds.has(inputId)) {
        throw new Error(`epoch authority: input ${inputId} was already spent`);
      }
    }
    const existing = (await this.events()).find(
      (e): e is EpochRecord => e.kind === 'epoch' && e.receiptId === receipt.receiptId,
    );
    if (existing && existing.root === root) return existing;
    if (existing) throw new Error('epoch authority: conflicting receipt id');

    const signature = await this.operator.sign(
      computeEpochCommitmentBytes(this.poolId, receipt.epoch, root, [receipt.receiptId], receipt.inputIds),
    );
    const event: EpochRecord = {
      kind: 'epoch',
      poolId: this.poolId,
      epoch: receipt.epoch,
      root,
      receiptId: receipt.receiptId,
      inputIds: [...receipt.inputIds],
      outputIds: [...receipt.outputIds],
      at: this.now(),
      signature,
    };
    await this.journal.append(event);
    return event;
  }

  /** Mark an epoch as published/anchored. Idempotent. */
  async markPublished(epoch: number): Promise<void> {
    const state = await this.current();
    if (epoch > state.epoch) throw new Error('epoch authority: cannot publish an unrecorded epoch');
    if (epoch <= state.publishedEpoch) return;
    await this.journal.append({
      kind: 'published',
      poolId: this.poolId,
      epoch,
      at: this.now(),
    });
  }

  /** Recover pending (durable but unpublished) epochs after a restart. */
  async recover(): Promise<EpochRecovery> {
    const report = await this.journal.recover();
    if (report.gapAt.length > 0) throw new Error('epoch authority: journal corruption (gap)');
    const state = await this.current();
    const events = await this.events();
    const pending = events.filter(
      (e): e is EpochRecord =>
        e.kind === 'epoch' && e.poolId === this.poolId && e.epoch > state.publishedEpoch,
    );
    return {
      epoch: state.epoch,
      root: state.root,
      publishedEpoch: state.publishedEpoch,
      pending,
    };
  }

  /**
   * Acceptance check: the receipt must be recorded, match the current
   * epoch/root, and verify against the operator key.
   */
  async verifyReceipt(receipt: VtxoOperatorReceipt, root: string): Promise<boolean> {
    const state = await this.current();
    if (receipt.epoch !== state.epoch || root !== state.root) return false;
    if (!state.recordedReceiptIds.has(receipt.receiptId)) return false;
    return verifyVtxoReceipt(this.operator, receipt, root);
  }
}

/** Open an epoch authority over a storage adapter (journal recovery on open). */
export async function openEpochAuthority(
  adapter: StorageAdapterWithCapabilities & CasStore,
  options: EpochAuthorityOptions & { namespace?: string; requireAckMode?: 'durably-acknowledged' | 'volatile' },
): Promise<EpochAuthority> {
  const journal = createJournal<EpochEvent>(adapter, {
    namespace: options.namespace ?? `totem_epoch:${options.poolId}:v1:`,
    ...(options.requireAckMode ? { requireAckMode: options.requireAckMode } : {}),
    validate: (event) => {
      if (!event || typeof event !== 'object') throw new Error('epoch event must be an object');
      if (event.poolId !== options.poolId) throw new Error('epoch event pool mismatch');
    },
  });
  await journal.recover();
  return new EpochAuthority({ ...options, journal });
}
