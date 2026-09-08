/**
 * omnia-pool/rooting.ts — Anchorable registry transitions.
 *
 * Wraps `@totemsdk/liquidity-bond` rooted transitions so pool mutations can
 * yield a signed delta + root (federation + on-chain anchoring) without the
 * caller hand-rolling the root computation.
 */

import { signRegistryTransition, type LiquidityBondRegistryState, type RegistryOperation, type RegistrySignedTransition } from '@totemsdk/liquidity-bond';
import type { RegistryRootingContext } from './types.js';

/**
 * Sign the resulting registry when a rooting context is provided, otherwise
 * return `undefined` (pure-record mode, no anchoring).
 */
export async function maybeSignTransition(
  rooting: RegistryRootingContext | undefined,
  registry: LiquidityBondRegistryState,
  op: RegistryOperation,
  previousRoot?: string,
): Promise<RegistrySignedTransition | undefined> {
  if (!rooting?.signer) return undefined;
  return signRegistryTransition(registry, rooting.op ?? op, rooting.signer, {
    previousRoot: previousRoot ?? rooting.previousRoot,
    reason: rooting.reason,
  });
}

/**
 * One-shot helper for transitions that do not carry their own rooting context
 * (e.g. sync mutations like `depositToPool`). Provide the mutated registry plus
 * an op description and get a signed, anchorable transition record.
 */
export async function commitRegistryTransition(params: {
  registry: LiquidityBondRegistryState;
  op: RegistryOperation;
  rooting: RegistryRootingContext;
}): Promise<RegistrySignedTransition> {
  return signRegistryTransition(params.registry, params.rooting.op ?? params.op, params.rooting.signer, {
    previousRoot: params.rooting.previousRoot,
    reason: params.rooting.reason,
  });
}