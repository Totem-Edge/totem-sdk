/**
 * @module @totemsdk/edge/intelligence
 *
 * First-class intelligence hosting for @totemsdk/edge.
 *
 * The canonical `EdgeIntelligencePort` contract and the provider-neutral
 * `createEdgeIntelligencePort` composition live in @totemsdk/intelligence.
 * Edge re-exports them here so edge runtimes can host any provider-neutral
 * `IntelligenceProvider` (QVAC, a remote LLM gateway, an embedded model host, …)
 * without edge naming any concrete provider.
 */

export { createEdgeIntelligencePort } from '@totemsdk/intelligence';
export type { EdgeIntelligencePort } from '@totemsdk/intelligence';