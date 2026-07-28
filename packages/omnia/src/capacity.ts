import type { CapacityWarning } from './types.js';
import { ChannelCapacityError } from './errors.js';

export const WOTS_CAPACITY_TOTAL = 4096;
export const CAPACITY_WARNING_APPROACHING = Math.floor(WOTS_CAPACITY_TOTAL * 0.75);
export const CAPACITY_WARNING_CRITICAL = Math.floor(WOTS_CAPACITY_TOTAL * 0.90);
export const CAPACITY_NEAR_EXHAUSTION = Math.floor(WOTS_CAPACITY_TOTAL * 0.95);

export function assessCapacity(used: number): { warning?: CapacityWarning; nearExhaustion: boolean } {
  if (used >= WOTS_CAPACITY_TOTAL) {
    throw new ChannelCapacityError(used, WOTS_CAPACITY_TOTAL);
  }
  if (used >= CAPACITY_NEAR_EXHAUSTION) {
    return { warning: 'critical', nearExhaustion: true };
  }
  if (used >= CAPACITY_WARNING_CRITICAL) {
    return { warning: 'critical', nearExhaustion: false };
  }
  if (used >= CAPACITY_WARNING_APPROACHING) {
    return { warning: 'approaching', nearExhaustion: false };
  }
  return { nearExhaustion: false };
}

export function flatSigningIndex(l1: number, l2: number): number {
  return l1 * 64 + l2;
}
