/**
 * Policy Anchor Coin — re-exported from `@totemsdk/kissvm`.
 *
 * This module previously carried a duplicate copy of the policy-anchor
 * builder. The canonical (fail-closed) implementation lives in
 * `@totemsdk/kissvm`; keeping a second copy here risked the transaction
 * plans silently using a vulnerable build. All symbols are re-exported so
 * existing `../policy-anchor.js` imports resolve to the canonical code.
 */

export {
  buildPolicyAnchorScript,
  buildPolicyAnchorState,
  buildRootRotationScript,
  buildEpochAdvancementScript,
  validatePolicyAnchorConfig,
} from '@totemsdk/kissvm';
export type { PolicyAnchorConfig } from '@totemsdk/kissvm';
