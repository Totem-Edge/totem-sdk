/**
 * @module @totemsdk/qvac
 *
 * QVAC intelligence adapter — wraps @qvac/sdk into @totemsdk/intelligence's
 * provider-neutral contracts.
 *
 * Dependencies:
 *   - @totemsdk/intelligence (contracts) — required
 *   - @qvac/sdk (runtime surface) — injected as QvacSdkLike, not hard-linked
 *
 * Subpaths:
 *   - .      createQvacIntelligenceProvider + types
 *   - /edge  createQvacEdgeIntelligencePort (EdgeIntelligencePort shape)
 *   - /raw   raw QVAC SDK surface passthrough types
 */

export { createQvacIntelligenceProvider } from './provider.js';
export { QVAC_OP_SHAPES, qvacOpShape } from './provider.js';
export type { QvacCallResult, QvacOpHandler, QvacOpShape, QvacProviderOptions, QvacSdkLike, QvacUsageExtractor } from './qvac-sdk.js';

// RFC-007 Phase 3a provider-verification gate (crash/disk behavior exercised
// against the injected runtime — labelled provider-verified, not an SDK
// guarantee).
export {
  QVAC_PROVIDER_VERIFIED_CLAIMS,
  verifyQvacRuntimeBehavior,
} from './provider-verification.js';
export type {
  QvacRuntimeBehaviorScenario,
  QvacRuntimeObservation,
  QvacRuntimeVerificationMark,
  VerifyQvacRuntimeBehaviorInput,
} from './provider-verification.js';

// Per-domain typed convenience adapters (also published as /<domain> subpaths).
export * from './domains/llm.js';
export * from './domains/embed.js';
export * from './domains/rag.js';
export * from './domains/asr.js';
export * from './domains/translate.js';
export * from './domains/tts.js';
export * from './domains/diffusion.js';
export * from './domains/ocr.js';
export * from './domains/classify.js';
export * from './domains/audiogen.js';
export * from './domains/video.js';
export * from './domains/vla.js';
export * from './domains/world.js';
export * from './domains/models.js';
export * from './domains/system.js';
export * from './domains/plugins.js';