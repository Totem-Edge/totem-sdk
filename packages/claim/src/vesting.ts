/**
 * Vesting schedule arithmetic.
 *
 * The schedule is intentionally pure and chain-agnostic: the caller supplies the
 * evaluation block. Integer division floors, so a vested amount is never rounded
 * up. The KISSVM script templates in `@totemsdk/kissvm` implement the same
 * release curve on-chain.
 */

export interface VestingSchedule {
  startBlock: number;
  cliffBlock: number;
  endBlock: number;
  totalAmount: bigint;
  /** The maximum claimable amount at the evaluated block (floor, never rounded up). */
  vestedAmount: bigint;
}

export interface VestingPolicyShape {
  startBlock: number;
  cliffBlock: number;
  endBlock: number;
  totalAmount?: bigint;
}

export type VestingScheduleResult =
  | { valid: true; schedule: VestingSchedule }
  | { valid: false; error: string };

/**
 * Compute the vested amount and the schedule bounds at `block`.
 *
 * `totalAmount` may come from the policy or from the claim context (the VTXO
 * amount, for example). Evaluation fails closed when neither is available.
 */
export function computeVestingSchedule(
  policy: VestingPolicyShape,
  block: number,
  totalAmount?: bigint,
): VestingScheduleResult {
  const total = policy.totalAmount ?? totalAmount;
  if (total === undefined) {
    return {
      valid: false,
      error: 'vesting total amount required (policy.totalAmount or context totalAmount)',
    };
  }
  if (total <= 0n) return { valid: false, error: 'vesting total amount must be positive' };

  const span = policy.endBlock - policy.startBlock;
  if (span <= 0) {
    return { valid: false, error: 'invalid vesting schedule: endBlock must be after startBlock' };
  }
  if (policy.cliffBlock < policy.startBlock || policy.cliffBlock > policy.endBlock) {
    return {
      valid: false,
      error: 'invalid vesting schedule: cliffBlock outside [startBlock, endBlock]',
    };
  }

  let vested: bigint;
  if (block >= policy.endBlock) {
    vested = total;
  } else {
    const elapsed = BigInt(block - policy.startBlock);
    vested = elapsed <= 0n ? 0n : (total * elapsed) / BigInt(span);
  }

  return {
    valid: true,
    schedule: {
      startBlock: policy.startBlock,
      cliffBlock: policy.cliffBlock,
      endBlock: policy.endBlock,
      totalAmount: total,
      vestedAmount: vested,
    },
  };
}

/**
 * The maximum amount claimable at `block`, or `undefined` when the schedule is
 * invalid or the total is unknown.
 */
export function vestedAmountAt(
  policy: VestingPolicyShape,
  block: number,
  totalAmount?: bigint,
): bigint | undefined {
  const result = computeVestingSchedule(policy, block, totalAmount);
  return result.valid ? result.schedule.vestedAmount : undefined;
}
