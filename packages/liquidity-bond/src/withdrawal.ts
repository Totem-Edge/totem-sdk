import { F, bytesToHex } from '@totemsdk/core';
import { computeAvailableLiquidity } from './position.js';
import type {
  WithdrawalIntent,
  LiquidityBondVerifyResult,
  CreateWithdrawalIntentParams,
  VerifyWithdrawalAllowedParams,
} from './types.js';

export const WITHDRAWAL_ID_DOMAIN = 'totemsdk/liquidity-bond/withdrawal/v1';

let withdrawalCounter = 0;

/**
 * Non-replayable withdrawal ID (#9): a domain hash over positionId + nonce,
 * so `wdrw-${Date.now()}-${counter}`-style forgeability in the same millisecond
 * is gone — the same position+nonce always yields the same ID, and a replayed
 * intent is detectable.
 */
export function computeWithdrawalId(positionId: string, nonce: string): string {
  return bytesToHex(F(new TextEncoder().encode(`${WITHDRAWAL_ID_DOMAIN}|${positionId}|${nonce}`)));
}

export function createWithdrawalIntent(params: CreateWithdrawalIntentParams): WithdrawalIntent {
  const now = params.requestedAt ?? Date.now();
  withdrawalCounter++;
  const nonce = params.nonce ?? `${now}-${withdrawalCounter}`;
  return {
    withdrawalId: computeWithdrawalId(params.positionId, nonce),
    positionId: params.positionId,
    poolId: params.poolId,
    ownerAddress: params.ownerAddress,
    amount: params.amount,
    status: 'requested',
    requestedAt: now,
    metadata: params.metadata,
  };
}

export function approveWithdrawalIntent(intent: WithdrawalIntent, now?: number): WithdrawalIntent {
  return { ...intent, status: 'approved', approvedAt: now ?? Date.now() };
}

export function rejectWithdrawalIntent(intent: WithdrawalIntent, reason: string, now?: number): WithdrawalIntent {
  return { ...intent, status: 'rejected', rejectedAt: now ?? Date.now(), reason };
}

export function cancelWithdrawalIntent(intent: WithdrawalIntent, now?: number): WithdrawalIntent {
  return { ...intent, status: 'cancelled' };
}

export function verifyWithdrawalAllowed(params: VerifyWithdrawalAllowedParams): LiquidityBondVerifyResult {
  const { intent, position, pool, now } = params;

  if (intent.amount <= 0n) {
    return { ok: false, reason: 'Withdrawal amount must be positive', code: 'AMOUNT_TOO_SMALL' };
  }

  // RFC-020 H7: only a chain-confirmed position has real withdrawable liquidity;
  // a declared/absent funding proof is a phantom position.
  if (position.amount <= 0n) {
    return { ok: false, reason: 'Position has no committed amount', code: 'POSITION_INVALID' };
  }
  if (position.funding?.status !== 'chain-confirmed') {
    return { ok: false, reason: 'Position funding is not chain-confirmed', code: 'WITHDRAWAL_NOT_ALLOWED' };
  }

  // Withdrawal is capped by unallocated (available) liquidity, not the gross
  // amount, so allocations/reservations cannot be drained.
  const available = computeAvailableLiquidity(position);
  if (intent.amount > available) {
    return { ok: false, reason: 'Withdrawal exceeds available liquidity', code: 'WITHDRAWAL_NOT_ALLOWED' };
  }

  if (intent.ownerAddress !== position.lpAddress) {
    return { ok: false, reason: 'Withdrawal owner does not match position LP', code: 'WITHDRAWAL_NOT_ALLOWED' };
  }

  const ts = now ?? Date.now();
  const lockTerms = position.lockTerms;

  if (lockTerms.lockType !== 'none' && !lockTerms.earlyWithdrawalAllowed) {
    if (lockTerms.unlockAfterMs !== undefined) {
      const unlockAt = position.createdAt + lockTerms.unlockAfterMs;
      if (ts < unlockAt) {
        return { ok: false, reason: 'Position is still locked', code: 'POSITION_LOCKED' };
      }
    }
  }

  if (position.status === 'depleted') {
    return { ok: false, reason: 'Position is depleted', code: 'POSITION_DEPLETED' };
  }

  return { ok: true, code: 'OK' };
}
