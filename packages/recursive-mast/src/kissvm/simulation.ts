/**
 * Transaction simulation through the KISSVM evaluator.
 *
 * Before requesting signatures or submitting a transaction, the
 * complete policy path should be simulated through the canonical
 * KISSVM evaluator to verify it will execute successfully.
 */

import { simulateSpend } from '@totemsdk/kissvm';
import type { CoinData, TxContext, EvalResult } from '@totemsdk/kissvm';
import { materializeRecursiveWitness } from './witness-adapter.js';
import type { RecursiveWitnessPlan } from './witness-adapter.js';

export interface PolicySimulationResult {
  passed: boolean;
  error?: string;
  trace: string[];
  instructionsUsed: number;
}

export interface PolicySimulationOptions {
  /**
   * RFC-020 RM-SIM-001: dev-only opt-in to the legacy, unverified
   * `mastBranches` path. Production MAST requires verifiable ScriptProofs, so
   * this is **never** defaulted — a plan with no proofs fails simulation unless
   * the caller explicitly asks for legacy behaviour.
   */
  allowLegacyMastBranches?: boolean;
}

export async function simulatePolicyTransaction(
  anchorScript: string,
  coinData: CoinData,
  txContext: TxContext,
  witnessPlan: RecursiveWitnessPlan,
  options: PolicySimulationOptions = {},
): Promise<PolicySimulationResult> {
  // RFC-020 RM-SIM-001: simulate exactly what production evaluates. Without
  // verifiable ScriptProofs, production MAST fails closed; simulation must too,
  // rather than silently resolving branches through the legacy mastBranches map.
  const hasProofs = Array.isArray(witnessPlan.scriptProofs) && witnessPlan.scriptProofs.length > 0;
  if (!hasProofs && !options.allowLegacyMastBranches) {
    return {
      passed: false,
      error:
        'simulatePolicyTransaction: witness plan has no scriptProofs; MAST requires verifiable proofs (pass allowLegacyMastBranches=true for dev-only simulation)',
      trace: [],
      instructionsUsed: 0,
    };
  }

  const { witness, mastBranches } = materializeRecursiveWitness(witnessPlan);

  const ctx: TxContext = {
    ...txContext,
    mastBranches,
    ...(options.allowLegacyMastBranches ? { allowLegacyMastBranches: true } : {}),
  };

  const result: EvalResult = await simulateSpend(anchorScript, coinData, ctx, witness);

  return {
    passed: result.passed,
    error: result.error,
    trace: result.trace,
    instructionsUsed: result.instructionsUsed,
  };
}

export async function simulateRecursiveSpend(
  anchorScript: string,
  coinData: CoinData,
  txContext: TxContext,
  witnessPlan: RecursiveWitnessPlan,
  options: PolicySimulationOptions = {},
): Promise<PolicySimulationResult> {
  return simulatePolicyTransaction(anchorScript, coinData, txContext, witnessPlan, options);
}
