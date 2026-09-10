/**
 * omnia/registry-anchor.ts — Embed the pool registry root in channel state (#26).
 *
 * A channel program carries the registry root as a program variable so on-chain
 * settlement cannot override an off-chain position: co-signers verify the
 * announced root against the channel commitment before signing.
 */

import type { ProgramTransition, SignedChannelState } from './types.js';

export const REGISTRY_ROOT_ACTION = 'registry_root';

export interface RegistryRootTransitionInputs {
  root: string;
  poolId: string;
  domain?: string;
}

/**
 * Build a `ProgramTransition` that carries the registry root into channel state.
 * Co-signers read this from the signed state and verify it against the pool
 * anchor before co-signing.
 */
export function buildRegistryRootTransition(input: RegistryRootTransitionInputs): ProgramTransition {
  return {
    action: REGISTRY_ROOT_ACTION,
    inputs: {
      root: input.root,
      poolId: input.poolId,
      ...(input.domain ? { domain: input.domain } : {}),
    },
    metadata: {
      kind: 'liquidity-bond-registry-root',
    },
  };
}

/**
 * Verify that a signed channel state announces the expected registry root.
 * Returns the failure reason when the root is missing or mismatched.
 */
export function verifyRegistryRootInState(
  state: SignedChannelState,
  expectedRoot: string,
): { valid: boolean; error?: string } {
  const transition = state.programTransition;
  if (!transition || transition.action !== REGISTRY_ROOT_ACTION) {
    return { valid: false, error: 'channel state carries no registry root transition' };
  }
  const announced = transition.inputs?.root;
  if (typeof announced !== 'string' || announced !== expectedRoot) {
    return { valid: false, error: `announced registry root ${announced} does not match expected ${expectedRoot}` };
  }
  return { valid: true };
}
