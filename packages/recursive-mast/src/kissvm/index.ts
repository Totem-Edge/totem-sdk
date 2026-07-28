/**
 * KISSVM integration for recursive MAST — script validation, witness
 * construction, transaction simulation, and resource analysis.
 *
 * These modules delegate to @totemsdk/kissvm for all VM-level operations.
 * recursive-mast owns policy coordination; kissvm owns execution.
 *
 * @module @totemsdk/recursive-mast/kissvm
 */

export {
  validatePolicyScript,
  validatePolicyScripts,
  validateRecursivePath,
} from './compile-validation.js';
export type { ScriptValidationResult, PathValidationResult } from './compile-validation.js';

export {
  convertWitnessPlanToKissvmInputs,
  materializeRecursiveWitness,
} from './witness-adapter.js';
export type { RecursiveWitnessPlan } from './witness-adapter.js';

export {
  simulatePolicyTransaction,
  simulateRecursiveSpend,
} from './simulation.js';
export type { PolicySimulationResult } from './simulation.js';

export {
  analyzeResourceUsage,
  checkResourceLimits,
} from './resource-analysis.js';
export type { ResourceAnalysis, ResourceLimits } from './resource-analysis.js';
