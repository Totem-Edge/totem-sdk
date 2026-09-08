import { F, bytesToHex } from '@totemsdk/core';
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

  if (intent.amount > position.amount) {
    return { ok: false, reason: 'Withdrawal exceeds position amount', code: 'WITHDRAWAL_NOT_ALLOWED' };
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
