/**
 * @totemsdk/qvac/rag — RAG domain adapter (chunk / ingest / search / embeddings / lifecycle).
 */

import type { IntelligenceProvider } from '@totemsdk/intelligence';
import { bindDomain } from './adapter.js';
import type { QvacOp } from './adapter.js';

export const ragDomain = 'rag' as const;

export interface RagSearchParams {
  query?: string;
  workspaceName?: string;
  topK?: number;
}

export interface RagSearchResult {
  results?: Array<{ id?: string; score?: number; text?: string }>;
}

export interface RagIngestParams {
  docs?: unknown[];
  workspaceName?: string;
}

export interface RagWorkspaceParams {
  workspaceName?: string;
}

export interface RagChunkParams extends RagWorkspaceParams {
  text?: string;
}

export interface RagEmbeddingsParams extends RagWorkspaceParams {
  vectors?: unknown[];
}

export interface QvacRagOps {
  ragChunk: QvacOp<RagChunkParams, unknown>;
  ragIngest: QvacOp<RagIngestParams, unknown>;
  ragSearch: QvacOp<RagSearchParams, RagSearchResult>;
  ragSaveEmbeddings: QvacOp<RagEmbeddingsParams, unknown>;
  ragDeleteEmbeddings: QvacOp<RagEmbeddingsParams, unknown>;
  ragReindex: QvacOp<RagWorkspaceParams, unknown>;
  ragListWorkspaces: QvacOp<Record<string, never>, unknown>;
  ragCloseWorkspace: QvacOp<RagWorkspaceParams, unknown>;
  ragDeleteWorkspace: QvacOp<RagWorkspaceParams, unknown>;
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