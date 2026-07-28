/**
 * Transaction simulation through the KISSVM evaluator.
 *
 * Before requesting signatures or submitting a transaction, the
 * complete policy path should be simulated through the canonical
 * KISSVM evaluator to verify it will execute successfully.
 */

import { simulateSpend, evaluateScript } from '@totemsdk/kissvm';
import type { CoinData, TxContext, ScriptWitness, EvalResult } from '@totemsdk/kissvm';
import { materializeRecursiveWitness } from './witness-adapter.js';
import type { RecursiveWitnessPlan } from './witness-adapter.js';

export interface PolicySimulationResult {
  passed: boolean;
  error?: string;
  trace: string[];
  instructionsUsed: number;
}

export async function simulatePolicyTransaction(
  anchorScript: string,
  coinData: CoinData,
  txContext: TxContext,
  witnessPlan: RecursiveWitnessPlan,
): Promise<PolicySimulationResult> {
  const { witness, mastBranches } = materializeRecursiveWitness(witnessPlan);

  const ctx: TxContext = {
    ...txContext,
    mastBranches,
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
): Promise<PolicySimulationResult> {
  return simulatePolicyTransaction(anchorScript, coinData, txContext, witnessPlan);
}
