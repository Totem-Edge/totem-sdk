/**
 * Transaction integration for recursive MAST — policy-aware transaction
 * planning and tx-builder adapter.
 *
 * recursive-mast plans the transaction; @totemsdk/tx-builder constructs it.
 * This module is optional — consumers using only discovery, storage, or
 * availability auditing do not need tx-builder.
 *
 * @module @totemsdk/recursive-mast/transaction
 */

export {
  createPolicyTransactionPlan,
  toEnhancedBuildParams,
} from './transaction-plan.js';
export type {
  PolicyTransactionPlan,
  PolicyTransactionInput,
  PolicyTransactionOutput,
} from './transaction-plan.js';

export {
  createAnchorTransactionPlan,
} from './anchor-transaction.js';
export type { AnchorTransactionConfig } from './anchor-transaction.js';

export {
  createActionTransactionPlan,
} from './action-transaction.js';
export type { ActionTransactionConfig } from './action-transaction.js';

export {
  createRootRotationTransactionPlan,
} from './rotation-transaction.js';
export type { RotationTransactionConfig } from './rotation-transaction.js';
