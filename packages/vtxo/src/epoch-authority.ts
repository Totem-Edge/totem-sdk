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

/**
 * OMN-106: a pre-signing reservation. The claim is durable before the operator
 * signs, so a concurrent append for the same input or epoch fails before a
 * signature exists, and a crash mid-append leaves a record that recovery can
 * complete instead of double-spending.
 */
export interface EpochClaim {
  kind: 'claim';
  poolId: string;
  epoch: number;
  root: string;
  receiptId: string;
  inputIds: string[];
  at: number;
}

export type EpochEvent = EpochRecord | EpochPublished | EpochClaim;

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
  /**
   * OMN-106: claims that were reserved but never completed with a signed epoch
   * (a crash between reservation and publication). The caller may retry
   * `append` with the same receipt; the reservation makes that safe.
   */
  unfinishedClaims: EpochClaim[];
}

function replay(events: readonly EpochEvent[], poolId: string): EpochAuthorityState & { publishedEpoch: number } {
  const epochs = events.filter((e): e is EpochRecord => e.kind === 'epoch' && e.poolId === poolId);
  const published = events.filter((e): e is EpochPublished => e.kind === 'published' && e.poolId === poolId);
  const claims = events.filter((e): e is EpochClaim => e.kind === 'claim' && e.poolId === poolId);
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
  // A claim reserves its inputs even before the signature exists.
  for (const c of claims) {
    for (const id of c.inputIds) spent.add(id);
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
  /** OMN-106: admission is serialized per authority instance. */
  private tail: Promise<unknown> = Promise.resolve();

  private locked<T>(run: () => Promise<T>): Promise<T> {
    const next = this.tail.then(run, run);
    this.tail = next.then(() => undefined, () => undefined);
    return next;
  }

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

  private async entries(): Promise<{ seq: number; record: EpochEvent }[]> {
    return (await this.journal.read()).map((entry) => ({ seq: entry.seq, record: entry.record }));
  }

  async current(): Promise<EpochAuthorityState & { publishedEpoch: number }> {
    return replay(await this.events(), this.poolId);
  }

  /**
   * Record a co-signed receipt. The operator signs the epoch commitment after
   * verifying the receipt, so the durable record cannot be forged later.
   */
  async append(receipt: VtxoOperatorReceipt, root: string): Promise<EpochRecord> {
    return this.locked(() => this.appendLocked(receipt, root));
  }

  private async appendLocked(receipt: VtxoOperatorReceipt, root: string): Promise<EpochRecord> {
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
    const existing = (await this.events()).find(
      (e): e is EpochRecord => e.kind === 'epoch' && e.receiptId === receipt.receiptId,
    );
    if (existing && existing.root === root) return existing;
    if (existing) throw new Error('epoch authority: conflicting receipt id');

    let claims = (await this.events()).filter(
      (e): e is EpochClaim => e.kind === 'claim' && e.poolId === this.poolId,
    );
    const priorClaim = claims.find((c) => c.receiptId === receipt.receiptId);
    if (priorClaim && priorClaim.root !== root) {
      throw new Error(`epoch authority: conflicting claim for receipt ${receipt.receiptId}`);
    }

    for (const inputId of receipt.inputIds) {
      if (state.spentInputIds.has(inputId)) {
        // A claim for this same receipt is a resumed append, not a conflict.
        const claimedByThisReceipt = claims.some(
          (c) => c.receiptId === receipt.receiptId && c.inputIds.includes(inputId),
        );
        if (claimedByThisReceipt) continue;
        throw new Error(`epoch authority: input ${inputId} was already spent`);
      }
    }

    // OMN-106: reserve before signing. A conflicting append now fails before any
    // signature is produced, and a crash leaves a claim recovery can complete.
    if (!priorClaim) {
      await this.journal.append({
        kind: 'claim',
        poolId: this.poolId,
        epoch: receipt.epoch,
        root,
        receiptId: receipt.receiptId,
        inputIds: [...receipt.inputIds],
        at: this.now(),
      });
      claims = (await this.events()).filter(
        (e): e is EpochClaim => e.kind === 'claim' && e.poolId === this.poolId,
      );
    }

    // OMN-106: the journal orders claims, so two authorities racing on the same
    // input resolve deterministically. Only the earliest reservation may sign;
    // every later one aborts here, before a signature exists.
    await this.assertClaimWins(receipt, root);

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

  /**
   * OMN-106: only the earliest durable reservation for an input may proceed. A
   * later claim for the same input always observes the earlier record (the
   * journal is monotonic), so the loser fails closed instead of producing a
   * second signature over a conflicting epoch.
   */
  private async assertClaimWins(receipt: VtxoOperatorReceipt, root: string): Promise<void> {
    const entries = await this.entries();
    const firstByInput = new Map<string, { seq: number; receiptId: string; root: string }>();
    for (const { seq, record } of entries) {
      if (record.kind !== 'claim' || record.poolId !== this.poolId) continue;
      for (const inputId of record.inputIds) {
        const prior = firstByInput.get(inputId);
        if (!prior || seq < prior.seq) {
          firstByInput.set(inputId, { seq, receiptId: record.receiptId, root: record.root });
        }
      }
    }
    for (const inputId of receipt.inputIds) {
      const owner = firstByInput.get(inputId);
      if (!owner) throw new Error(`epoch authority: input ${inputId} has no reservation`);
      if (owner.receiptId === receipt.receiptId && owner.root !== root) {
        throw new Error(`epoch authority: input ${inputId} is reserved for a different root`);
      }
      if (owner.receiptId !== receipt.receiptId) {
        throw new Error(
          `epoch authority: input ${inputId} is reserved by receipt ${owner.receiptId}`,
        );
      }
    }
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

  /**
   * OMN-107: authenticate the replayed history instead of trusting structure.
   * Every epoch signature must verify, no epoch may publish two roots, and no
   * input may be consumed by two receipts.
   */
  async verifyHistory(): Promise<void> {
    const events = await this.events();
    const epochs = events.filter(
      (e): e is EpochRecord => e.kind === 'epoch' && e.poolId === this.poolId,
    );
    const claims = events.filter(
      (e): e is EpochClaim => e.kind === 'claim' && e.poolId === this.poolId,
    );
    const epochByReceipt = new Map<string, EpochRecord>();
    const rootByEpoch = new Map<number, string>();
    const receiptByInput = new Map<string, string>();

    for (const epoch of epochs) epochByReceipt.set(epoch.receiptId, epoch);

    // A reservation must agree with the epoch it produced: a rewritten root is
    // the signature-replay shape this check exists to reject.
    for (const claim of claims) {
      const match = epochByReceipt.get(claim.receiptId);
      if (!match) continue;
      if (match.root !== claim.root) {
        throw new Error(
          `epoch authority: claim for receipt ${claim.receiptId} does not match its recorded root`,
        );
      }
      if (match.epoch !== claim.epoch) {
        throw new Error(`epoch authority: claim for receipt ${claim.receiptId} does not match its epoch`);
      }
    }

    for (const epoch of epochs) {
      const ok = await this.operator.verify(
        computeEpochCommitmentBytes(this.poolId, epoch.epoch, epoch.root, [epoch.receiptId], epoch.inputIds),
        epoch.signature,
      );
      if (!ok) {
        throw new Error(`epoch authority: signature does not verify for epoch ${epoch.epoch}`);
      }
      const priorRoot = rootByEpoch.get(epoch.epoch);
      if (priorRoot !== undefined && priorRoot !== epoch.root) {
        throw new Error(`epoch authority: conflicting roots recorded for epoch ${epoch.epoch}`);
      }
      rootByEpoch.set(epoch.epoch, epoch.root);
      for (const inputId of epoch.inputIds) {
        const priorReceipt = receiptByInput.get(inputId);
        if (priorReceipt !== undefined && priorReceipt !== epoch.receiptId) {
          throw new Error(`epoch authority: input ${inputId} was consumed by two receipts`);
        }
        receiptByInput.set(inputId, epoch.receiptId);
      }
    }
  }

  /** Recover pending (durable but unpublished) epochs after a restart. */
  async recover(): Promise<EpochRecovery> {
    const report = await this.journal.recover();
    if (report.gapAt.length > 0) throw new Error('epoch authority: journal corruption (gap)');
    await this.verifyHistory();
    const state = await this.current();
    const events = await this.events();
    const pending = events.filter(
      (e): e is EpochRecord =>
        e.kind === 'epoch' && e.poolId === this.poolId && e.epoch > state.publishedEpoch,
    );
    const claims = events.filter(
      (e): e is EpochClaim => e.kind === 'claim' && e.poolId === this.poolId,
    );
    const recordedReceipts = new Set(events.filter((e): e is EpochRecord => e.kind === 'epoch').map((e) => e.receiptId));
    return {
      epoch: state.epoch,
      root: state.root,
      publishedEpoch: state.publishedEpoch,
      pending,
      unfinishedClaims: claims.filter((c) => !recordedReceipts.has(c.receiptId)),
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
  const authority = new EpochAuthority({ ...options, journal });
  // OMN-107: recovery is not authenticated until the signatures are checked.
  await authority.verifyHistory();
  return authority;
}
