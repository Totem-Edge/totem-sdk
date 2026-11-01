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

/**
 * Reset all channel sequence watermarks.
 * Intended only for test isolation — call in `beforeEach` to prevent watermarks
 * from bleeding between tests that share a fixed `channelId`.
 */
export function _resetChannelWatermarks(): void {
  _channelWatermarks.clear();
  _sealedWatermarks.clear();
}
