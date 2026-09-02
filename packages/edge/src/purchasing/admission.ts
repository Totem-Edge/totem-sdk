/**
 * purchasing/admission.ts — Edge-level Machine Work Admission policy and
 * TxPoW adapter.
 *
 * Edge constructs the proposal commitment, builds a MachineWorkAction, and
 * delegates to @totemsdk/txpow's mineWorkAdmission / verifyWorkAdmission.
 * Edge does NOT implement nonce mining.
 *
 * Hard requirements enforced here:
 *   - per-turn AND total (cumulative) work budgets
 *   - progressive counteroffer difficulty, bounded by local policy
 *   - one-shot challenges (consumed after successful admission)
 *   - only locally returned verifyWorkAdmission() metadata may trigger relay
 *   - relay uses MinimaWorkRelay.submitBlock() (never the deprecated
 *     provider.broadcastBlockCandidate)
 *   - relay is best-effort and orthogonal to economic success/failure
 */

import {
  mineWorkAdmission,
  verifyWorkAdmission,
  type MachineWorkAction,
  type MachineWorkAdmissionProof,
  type MinimaWorkRelay,
  type MinimaWorkTemplateProvider,
  type WorkAdmissionVerification,
  type WorkChallenge,
} from '@totemsdk/txpow';
import { estimateMiningCost } from '@totemsdk/txpow';
import { challengeFingerprint } from '@totemsdk/txpow';
import type {
  LocalWorkBudget,
  WorkDifficultyPolicy,
  WorkMode,
} from './types.js';

/** Convert a hex target to a bigint (for budget comparisons). */
function targetToBigInt(hex: string): bigint {
  const h = hex.startsWith('0x') ? hex.slice(2) : hex;
  let v = 0n;
  for (let i = 0; i < h.length; i += 2) {
    v = (v << 8n) | BigInt(parseInt(h.slice(i, i + 2), 16));
  }
  return v;
}

/** Expected hashes for a target ≈ MAX_HASH / target. */
function expectedHashesForTarget(targetHex: string): bigint {
  const target = targetToBigInt(targetHex);
  if (target === 0n) return 0n;
  return (2n ** 256n - 1n) / target;
}

/**
 * Edge work policy — answers "am I willing to perform this challenge?"
 *
 * Cryptographic verification still depends on challenge.target, not local
 * timing estimates. The budget only gates whether the machine proceeds.
 */
export class EdgeWorkPolicy {
  constructor(
    private readonly mode: WorkMode,
    private readonly budget: LocalWorkBudget,
    private readonly difficulty: WorkDifficultyPolicy,
    private readonly hashRatePerSec: number,
  ) {}

  getMode(): WorkMode {
    return this.mode;
  }

  /**
   * Resolve the difficulty target for a given round, bounded by local policy.
   * Returns null when the round's target would exceed the configured maximum.
   */
  targetForRound(round: number): string | null {
    const targets = this.difficulty.roundTargets;
    let target: string;
    if (targets && targets.length > 0) {
      target = targets[Math.min(round, targets.length - 1)];
    } else {
      target = this.difficulty.baseTarget;
    }
    // A harder target is a SMALLER numeric value. Refuse if it is harder
    // (smaller) than the configured max.
    if (targetToBigInt(target) < targetToBigInt(this.difficulty.maxTarget)) {
      return null;
    }
    return target;
  }

  /**
   * Decide whether the machine is willing to perform a challenge for a given
   * round, given the cumulative work already spent in this negotiation.
   */
  async willingToWork(
    challenge: WorkChallenge,
    round: number,
    cumulativeWork: bigint,
  ): Promise<{ ok: boolean; reason?: string }> {
    if (this.mode === 'disabled') {
      return { ok: false, reason: 'work is disabled' };
    }

    // A harder target is a SMALLER numeric value. Refuse any challenge that is
    // harder than the local policy max (excessive requested work).
    if (targetToBigInt(challenge.target) < targetToBigInt(this.difficulty.maxTarget)) {
      return { ok: false, reason: 'challenge exceeds local work budget' };
    }

    const target = this.targetForRound(round);
    if (target === null) {
      return { ok: false, reason: `round ${round} difficulty exceeds local policy max` };
    }
    // The challenge target must match the policy target for this round.
    if (challenge.target !== target) {
      return { ok: false, reason: 'challenge target does not match local policy for round' };
    }

    const expected = expectedHashesForTarget(challenge.target);

    // Per-turn budget.
    if (this.budget.maxExpectedHashes !== undefined && expected > this.budget.maxExpectedHashes) {
      return { ok: false, reason: 'challenge exceeds per-turn work budget' };
    }
    if (this.budget.maxEstimatedLocalMs !== undefined) {
      const est = estimateMiningCost(hexToBytes(challenge.target), this.hashRatePerSec);
      if (est.expectedSeconds * 1000 > this.budget.maxEstimatedLocalMs) {
        return { ok: false, reason: 'challenge exceeds estimated local time budget' };
      }
    }

    // Total (cumulative) budget across the whole negotiation.
    if (
      this.budget.maxCumulativeWorkPerNegotiation !== undefined &&
      cumulativeWork + expected > this.budget.maxCumulativeWorkPerNegotiation
    ) {
      return { ok: false, reason: 'challenge would exceed cumulative work budget' };
    }

    return { ok: true };
  }

  /** Expected hashes for a target (exposed for telemetry). */
  expectedHashes(targetHex: string): bigint {
    return expectedHashesForTarget(targetHex);
  }
}

function hexToBytes(hex: string): Uint8Array {
  const h = hex.startsWith('0x') ? hex.slice(2) : hex;
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < h.length; i += 2) {
    out[i / 2] = parseInt(h.slice(i, i + 2), 16);
  }
  return out;
}

/**
 * TxPoW adapter — the only place Edge touches @totemsdk/txpow.
 */
export class EdgeTxPowAdapter {
  constructor(
    private readonly templateProvider: MinimaWorkTemplateProvider,
    private readonly relay?: MinimaWorkRelay,
  ) {}

  /**
   * Mine a Machine Work Admission proof for a proposal.
   *
   * The action commitment binds negotiationId, proposalId, parentProposalId,
   * manifestId, proposer, recipient, round, terms hash, and proposal expiry.
   *
   * NOTE: mining does NOT relay. Only the locally returned
   * verifyWorkAdmission() metadata may trigger block relay (see verify()).
   */
  async mine(
    action: MachineWorkAction,
    challenge: WorkChallenge,
    opts?: {
      signal?: AbortSignal;
      maxIterations?: number;
      prng?: Uint8Array;
      forceJs?: boolean;
      _skipWorker?: boolean;
    },
  ): Promise<MachineWorkAdmissionProof> {
    return mineWorkAdmission(action, challenge, this.templateProvider, {
      signal: opts?.signal,
      maxIterations: opts?.maxIterations,
      prng: opts?.prng,
      forceJs: opts?.forceJs,
      _skipWorker: opts?._skipWorker,
    });
  }

  /**
   * Verify a Machine Work Admission proof.
   *
   * Only the locally returned verification metadata may trigger block relay.
   * Relay is best-effort: a relay failure must never invalidate a valid
   * proposal or stall negotiation.
   */
  async verify(
    action: MachineWorkAction,
    challenge: WorkChallenge,
    proof: MachineWorkAdmissionProof,
  ): Promise<WorkAdmissionVerification> {
    const result = await verifyWorkAdmission(action, challenge, proof, this.templateProvider);

    // Best-effort relay of a current broadcastable Minima block. Orthogonal
    // to economic success/failure — failures are swallowed.
    if (result.valid && result.broadcastable === true && this.relay) {
      try {
        const envelope = hexToBytes(proof.txpowEnvelope);
        await this.relay.submitBlock(envelope);
      } catch {
        // Relay failure must not invalidate the proposal.
      }
    }

    return result;
  }

  /** One-shot challenge fingerprint. */
  fingerprint(challenge: WorkChallenge): string {
    return challengeFingerprint(challenge);
  }
}
