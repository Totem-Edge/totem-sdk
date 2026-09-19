/**
 * @module @totemsdk/intelligence
 *
 * Provider-neutral intelligence contracts — capabilities, operations,
 * receipts, and errors for local self-hosted AI inference.
 *
 * This package carries zero runtime dependencies and never imports a concrete
 * inference provider. Concrete providers (e.g. @totemsdk/qvac wrapping
 * @qvac/sdk) implement the contracts defined here.
 */

export { INTELLIGENCE_VERSION } from './constants.js';

export {
  INTELLIGENCE_DOMAINS,
  INTELLIGENCE_CAPABILITIES,
  INTELLIGENCE_OPS,
} from './constants.js';
export type {
  IntelligenceDomain,
  IntelligenceCapability,
  IntelligenceOp,
} from './constants.js';

export {
  IntelligenceError,
  INTELLIGENCE_ERROR_MESSAGES,
} from './errors.js';
export type { IntelligenceErrorCode } from './errors.js';

export type {
  IntelligenceUsage,
  IntelligenceContext,
  IntelligenceOperation,
  IntelligenceStreamOperation,
  IntelligenceResult,
  IntelligenceErrorResult,
  IntelligenceOutcome,
  IntelligencePortResult,
  IntelligenceStreamChunk,
  IntelligenceReceipt,
  IntelligenceProvider,
  IntelligenceProviderInfo,
  IntelligenceProviderOptions,
  IntelligenceDomainOrString,
  EdgeIntelligencePort,
} from './types.js';

export { createEdgeIntelligencePort } from './port.js';

export {
  RAG_WORKSPACE_OPS,
  RAG_DESTRUCTIVE_OPS,
  CONTENT_DENY_CODE,
  evaluateContentAccess,
  createContentAccessGatedProvider,
} from './content-access.js';
export type {
  ContentWorkspaceEntitlement,
  ContentAccessPolicy,
  ContentAccessDecision,
  RagWorkspaceOp,
} from './content-access.js';