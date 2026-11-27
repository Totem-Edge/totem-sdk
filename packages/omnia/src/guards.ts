import { DoubleSignError, SequenceError } from './errors.js';
import { assessCapacity } from './capacity.js';

// ─────────────────────────────────────────────────────────────────────────────
// Module-level signing guards
//
// Persist the most-recently-signed (sequence, payloadHash) per channel ID.
// Because JavaScript is single-threaded, this map is always consistent within
// one process. It provides authoritative enforcement that is independent of the
// mutable channel object: stale copies can never sign a different payload at a
// sequence that has already been committed, and the sequence number can never
// go backwards regardless of which channel object a caller holds.
//
// This lives outside `channel.ts` so every signing entry point — including the
// co-sign path in `sign.ts` — can use it without an import cycle.
// ─────────────────────────────────────────────────────────────────────────────
const _channelWatermarks = new Map<string, { sequence: number; payloadHash: string }>();

/**
 * Sequences for which this process has already produced at least one WOTS
 * signature. A sealed guard can never be released: releasing it would allow a
 * different payload at the same sequence, which is precisely the double-sign
 * the watermark exists to prevent.
 */
const _sealedWatermarks = new Set<string>();

function sealKey(channelId: string, sequence: number): string {
  return `${channelId}:${sequence}`;
}

/**
 * Enforce all per-update invariants that must hold for every state transition
 * regardless of whether the caller is `updateState`, `addHTLC`, `fulfillHTLC`,
 * `timeoutHTLC` or the peer co-sign path.
 *
 * Specifically:
 *   1. WOTS capacity check: throws `ChannelCapacityError` at 100%, returns
 *      `'CAPACITY_NEAR_EXHAUSTION'` at 95% (caller must NOT advance watermark).
 *   2. Stale-sequence guard (SequenceError): rejects any attempt to sign a
 *      sequence that is behind the module-level watermark.
 *   3. Double-sign guard (DoubleSignError): rejects a different payload at a
 *      sequence already committed by this process.
 *   4. Watermark advance: after all guards pass, records `(newSequence,
 *      payloadHash)` synchronously — before any async work — so no concurrent
 *      call can slip in between the guard and the WOTS reservation.
 *
 * @param channelId   - Channel identifier for the watermark map key.
 * @param newSequence - Proposed next sequence number.
 * @param payloadHash - Hex-encoded SHA3-256 of the full off-chain state
 *                     commitment (sequence + balances + pending HTLCs).
 * @returns `'CAPACITY_NEAR_EXHAUSTION'` when signing is blocked at the 95%
 *          threshold; `null` when signing may proceed.
 */
export function enforceUpdateGuards(
  channelId: string,
  newSequence: number,
  payloadHash: string,
  pendingProposal?: { sequence: number; payloadHash: string },
): 'CAPACITY_NEAR_EXHAUSTION' | null {
  // 1. Capacity — throws ChannelCapacityError at 100%, nearExhaustion at 95%.
  // Each state consumes two WOTS leaves (update + pre-signed settlement).
  const { nearExhaustion } = assessCapacity(newSequence * 2);

  // 2/3. Watermark: stale-sequence and double-sign protection.
  // Check both the module-level map (in-process) and the channel's persisted
  // pendingProposal (cross-restart). The module-level map provides the stronger
  // guarantee within one process; the channel watermark covers crash/restart.
  const watermark = _channelWatermarks.get(channelId);
  if (watermark) {
    if (watermark.sequence > newSequence) {
      throw new SequenceError(watermark.sequence, newSequence);
    }
    if (watermark.sequence === newSequence && watermark.payloadHash !== payloadHash) {
      throw new DoubleSignError(newSequence);
    }
  }
  if (pendingProposal) {
    if (pendingProposal.sequence > newSequence) {
      throw new SequenceError(pendingProposal.sequence, newSequence);
    }
    if (pendingProposal.sequence === newSequence && pendingProposal.payloadHash !== payloadHash) {
      throw new DoubleSignError(newSequence);
    }
  }

  // Block without consuming the watermark slot — caller retries or settles.
  if (nearExhaustion) {
    return 'CAPACITY_NEAR_EXHAUSTION';
  }

  // 4. Advance watermark synchronously before any async signing work.
  _channelWatermarks.set(channelId, { sequence: newSequence, payloadHash });
  return null;
}

/**
 * Mark a sequence as having produced a signature. Call this immediately after
 * the first successful signature for the sequence. From that point on,
 * `releaseUpdateGuard` becomes a no-op.
 */
export function sealUpdateGuard(channelId: string, sequence: number): void {
  _sealedWatermarks.add(sealKey(channelId, sequence));
}

/**
 * Release a watermark advance when signing failed *before* any signature was
 * produced. A failed wallet/lease round must not poison the next attempt at the
 * same sequence with a stale, different payload — but once a signature exists,
 * the guard is sealed and a different payload at that sequence must stay
 * rejected.
 */
export function releaseUpdateGuard(channelId: string, sequence: number, payloadHash: string): void {
  if (_sealedWatermarks.has(sealKey(channelId, sequence))) return;
  const watermark = _channelWatermarks.get(channelId);
  if (watermark && watermark.sequence === sequence && watermark.payloadHash === payloadHash) {
    _channelWatermarks.delete(channelId);
  }
}


// ─────────────────────────────────────────────────────────────────────────────
// OMN-039 — durable signing intents
//
// The module-level watermark above is authoritative only for the lifetime of the
// process. A crash between "WOTS signature produced" and "channel persisted"
// would otherwise let the restarted process sign a *different* payload at the
// same sequence. A signing intent is therefore recorded — append-only — before
// the signer is invoked, and consulted by every later attempt for that channel.
//
// `MemorySigningJournal` is the default so single-process callers keep working;
// production hosts must supply a durable journal (the host exposes it as a
// dependency) so the record survives a restart.
// ─────────────────────────────────────────────────────────────────────────────

export type SigningIntentState = 'pending' | 'signed' | 'abandoned' | 'ambiguous';

export interface SigningIntent {
  channelId: string;
  sequence: number;
  payloadHash: string;
  purpose: string;
  state: SigningIntentState;
  recordedAt: number;
  /** WOTS lease reservations held for this attempt, when known. */
  reservationIds?: string[];
}

export interface SigningIntentJournal {
  record(intent: SigningIntent): Promise<void> | void;
  list(channelId: string): Promise<SigningIntent[]> | SigningIntent[];
  update?(intent: SigningIntent): Promise<void> | void;
}

/** In-process journal. Survives nothing; use as the default and in tests. */
export class MemorySigningJournal implements SigningIntentJournal {
  private readonly intents = new Map<string, Map<string, SigningIntent>>();

  private key(intent: Pick<SigningIntent, 'sequence' | 'payloadHash'>): string {
    return `${intent.sequence}:${intent.payloadHash}`;
  }

  record(intent: SigningIntent): void {
    let byChannel = this.intents.get(intent.channelId);
    if (!byChannel) {
      byChannel = new Map();
      this.intents.set(intent.channelId, byChannel);
    }
    byChannel.set(this.key(intent), { ...intent });
    // Bound retention: abandoned attempts carry no signing guarantee, so they
    // are the first to go when a long-lived channel accumulates history.
    if (byChannel.size > 4096) {
      for (const [key, value] of byChannel) {
        if (value.state === 'abandoned' && key !== this.key(intent)) byChannel.delete(key);
        if (byChannel.size <= 4096) break;
      }
    }
  }

  update(intent: SigningIntent): void {
    this.record(intent);
  }

  list(channelId: string): SigningIntent[] {
    const byChannel = this.intents.get(channelId);
    return byChannel ? [...byChannel.values()].map((intent) => ({ ...intent })) : [];
  }

  clear(): void {
    this.intents.clear();
  }
}

let _signingJournal: SigningIntentJournal = new MemorySigningJournal();

/**
 * Install the journal used by `beginSigningAttempt`. Hosts call this once at
 * start-up with a durable implementation; omit it to keep the in-memory
 * default.
 */
export function setSigningJournal(journal?: SigningIntentJournal): void {
  _signingJournal = journal ?? new MemorySigningJournal();
}

export function getSigningJournal(): SigningIntentJournal {
  return _signingJournal;
}

/**
 * OMN-108: true while the built-in in-memory journal is installed. The default
 * exists for tests and single-process tools; a host that signs channel state
 * must install a durable journal, otherwise the signing watermark is lost on
 * restart and independent processes do not share it.
 */
export function signingJournalIsInMemory(): boolean {
  return _signingJournal instanceof MemorySigningJournal;
}

export function isUpdateGuardSealed(channelId: string, sequence: number): boolean {
  return _sealedWatermarks.has(sealKey(channelId, sequence));
}

/**
 * Record the intent to sign `(channelId, sequence, payloadHash)` before any
 * WOTS signature exists. Throws `DoubleSignError` when another payload was
 * already signed — or may still have been signed — at that sequence.
 */
/**
 * OMN-108 (audit 3): the admission decision is serialized per channel inside
 * this process. A durable journal must still provide the same guarantee across
 * processes; the write is a single `record` so a CAS-capable journal can make
 * it atomic.
 */
const signingAdmissionLocks = new Map<string, Promise<unknown>>();

function withSigningAdmissionLock<T>(channelId: string, run: () => Promise<T>): Promise<T> {
  const prior = signingAdmissionLocks.get(channelId) ?? Promise.resolve();
  const next = prior.then(run, run);
  signingAdmissionLocks.set(channelId, next.then(() => undefined, () => undefined));
  return next;
}

export async function beginSigningAttempt(intent: {
  channelId: string;
  sequence: number;
  payloadHash: string;
  purpose: string;
  reservationIds?: string[];
}): Promise<void> {
  return withSigningAdmissionLock(intent.channelId, async () => {
    const journal = _signingJournal;

    let existing: SigningIntent[];
    try {
      existing = await journal.list(intent.channelId);
    } catch (error) {
      // OMN-108: an unreadable journal is not evidence that nothing was signed.
      // Failing closed is the only safe reading — otherwise a storage fault
      // licenses a second signature at a sequence that may already be signed.
      throw new Error(
        `signing journal for channel ${intent.channelId} is unavailable; refusing to sign `
        + `sequence ${intent.sequence}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    for (const prior of existing) {
      if (prior.sequence === intent.sequence) {
        if (prior.payloadHash !== intent.payloadHash && prior.state !== 'abandoned') {
          throw new DoubleSignError(intent.sequence);
        }
      } else if (prior.sequence > intent.sequence && prior.state !== 'abandoned') {
        throw new SequenceError(prior.sequence, intent.sequence);
      }
    }

    try {
      await journal.record({
        channelId: intent.channelId,
        sequence: intent.sequence,
        payloadHash: intent.payloadHash,
        purpose: intent.purpose,
        state: 'pending',
        recordedAt: Date.now(),
        ...(intent.reservationIds ? { reservationIds: intent.reservationIds } : {}),
      });
    } catch (error) {
      // If the intent cannot be recorded, nothing may be signed.
      throw new Error(
        `signing journal could not record the intent for channel ${intent.channelId} `
        + `sequence ${intent.sequence}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  });
}

async function transitionSigningAttempt(
  channelId: string,
  sequence: number,
  payloadHash: string,
  state: SigningIntentState,
): Promise<void> {
  const journal = _signingJournal;
  if (!journal.update) return;
  try {
    const existing = await journal.list(channelId);
    const match = existing.find(
      (intent) => intent.sequence === sequence && intent.payloadHash === payloadHash,
    );
    if (match) await journal.update({ ...match, state });
  } catch {
    // The durable record already blocks conflicting payloads; failing to
    // annotate it must not fail the signing flow.
  }
}

/** Mark the intent as completed once a signature exists for the payload. */
export async function commitSigningAttempt(
  channelId: string,
  sequence: number,
  payloadHash: string,
): Promise<void> {
  await transitionSigningAttempt(channelId, sequence, payloadHash, 'signed');
}

/**
 * OMN-109: the signer's outcome is unknown (it may hold a signature). The intent
 * stays blocking; only an explicit reconciliation may resolve it.
 */
export async function markSigningAttemptAmbiguous(
  channelId: string,
  sequence: number,
  payloadHash: string,
): Promise<void> {
  await transitionSigningAttempt(channelId, sequence, payloadHash, 'ambiguous');
}

/**
 * Release an attempt that failed before any signature was produced. Only a
 * `pending` intent may be abandoned; a sealed attempt stays blocking forever.
 */
export async function abandonSigningAttempt(
  channelId: string,
  sequence: number,
  payloadHash: string,
): Promise<void> {
  if (isUpdateGuardSealed(channelId, sequence)) return;
  await transitionSigningAttempt(channelId, sequence, payloadHash, 'abandoned');
}

/**
 * Reset all channel sequence watermarks.
 * Intended only for test isolation — call in `beforeEach` to prevent watermarks
 * from bleeding between tests that share a fixed `channelId`.
 */
export function _resetChannelWatermarks(): void {
  _channelWatermarks.clear();
  _sealedWatermarks.clear();
  if (_signingJournal instanceof MemorySigningJournal) _signingJournal.clear();
}
