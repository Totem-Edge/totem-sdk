/**
 * @totemsdk/qvac/rag — RAG domain adapter (chunk / ingest / search / embeddings / lifecycle).
 *
 * Types are the genuine `@qvac/sdk@0.19.0` RAG shapes. Note the decorated
 * requests: `ragIngest`, `ragSaveEmbeddings`, `ragReindex` resolve to values
 * but carry a synchronous upstream `requestId` the provider forwards to
 * `sdk.cancel({ requestId })`.
 */

import type { IntelligenceProvider } from '@totemsdk/intelligence';
import { bindDomain } from './adapter.js';
import type { QvacOp } from './adapter.js';

// RFC-007 §5 content-access gate: workspace-scoped entitlement enforcement
// below dispatch, above the provider call. Re-exported so RAG hosters can
// compose `createContentAccessGatedProvider(policy, qvacProvider)` and then
// bind the typed domain adapter on top.
export {
  RAG_WORKSPACE_OPS,
  RAG_DESTRUCTIVE_OPS,
  CONTENT_DENY_CODE,
  evaluateContentAccess,
  createContentAccessGatedProvider,
} from '@totemsdk/intelligence';
export type {
  ContentWorkspaceEntitlement,
  ContentAccessPolicy,
  ContentAccessDecision,
  RagWorkspaceOp,
} from '@totemsdk/intelligence';

import type {
  RagChunkParams,
  RagDoc,
  RagSaveEmbeddingsResult,
  RagSearchParams,
  RagSearchResult,
  RagReindexParams,
  RagWorkspaceInfo,
} from '@qvac/sdk';

export const ragDomain = 'rag' as const;

export type {
  RagChunkParams,
  RagDoc,
  RagEmbeddedDoc,
  RagSaveEmbeddingsResult,
  RagSearchParams,
  RagSearchResult,
  RagReindexParams,
  RagWorkspaceInfo,
} from '@qvac/sdk';

export interface RagIngestParams {
  documents: unknown[];
  embeddingModelId: string;
  workspaceId?: string;
}

export interface RagSaveEmbeddingsParams {
  chunks: import('@qvac/sdk').RagEmbeddedDoc[];
  embeddingModelId: string;
  workspaceId?: string;
}

export type RagDeleteEmbeddingsParams = {
  id?: string | string[];
  workspaceId?: string;
};

export interface RagCloseWorkspaceParams {
  workspaceId: string;
  deleteOnClose?: boolean;
}

export interface RagDeleteWorkspaceParams {
  workspaceId: string;
}

export interface QvacRagOps {
  ragChunk: QvacOp<RagChunkParams, RagDoc[]>;
  ragIngest: QvacOp<RagIngestParams, { processed: RagSaveEmbeddingsResult[]; droppedIndices: number[] }>;
  ragSearch: QvacOp<RagSearchParams, RagSearchResult[]>;
  ragSaveEmbeddings: QvacOp<RagSaveEmbeddingsParams, RagSaveEmbeddingsResult[]>;
  ragDeleteEmbeddings: QvacOp<RagDeleteEmbeddingsParams, void>;
  ragReindex: QvacOp<RagReindexParams, import('@qvac/sdk').RagReindexResult>;
  ragListWorkspaces: QvacOp<Record<string, never>, RagWorkspaceInfo[]>;
  ragCloseWorkspace: QvacOp<RagCloseWorkspaceParams, void>;
  ragDeleteWorkspace: QvacOp<RagDeleteWorkspaceParams, void>;
}

export function ragAdapter(provider: IntelligenceProvider): QvacRagOps {
  return {
    ragChunk: bindDomain(provider, ragDomain, 'ragChunk'),
    ragIngest: bindDomain(provider, ragDomain, 'ragIngest'),
    ragSearch: bindDomain(provider, ragDomain, 'ragSearch'),
    ragSaveEmbeddings: bindDomain(provider, ragDomain, 'ragSaveEmbeddings'),
    ragDeleteEmbeddings: bindDomain(provider, ragDomain, 'ragDeleteEmbeddings'),
    ragReindex: bindDomain(provider, ragDomain, 'ragReindex'),
    ragListWorkspaces: bindDomain(provider, ragDomain, 'ragListWorkspaces'),
    ragCloseWorkspace: bindDomain(provider, ragDomain, 'ragCloseWorkspace'),
    ragDeleteWorkspace: bindDomain(provider, ragDomain, 'ragDeleteWorkspace'),
  };
}