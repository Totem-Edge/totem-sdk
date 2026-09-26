/**
 * @module @totemsdk/edge/decision
 *
 * First-class decision hosting for @totemsdk/edge.
 *
 * The canonical `EdgeDecisionPort` contract and the provider-neutral
 * `createEdgeDecisionPort` composition live in @totemsdk/decision. Edge
 * re-exports them here so edge runtimes can host any decision runtime as a
 * sibling of `EdgeIntelligencePort` — never as an intelligence domain.
 */

export { createEdgeDecisionPort } from '@totemsdk/decision';
export type { EdgeDecisionPort } from '@totemsdk/decision';
