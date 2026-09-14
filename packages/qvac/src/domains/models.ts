/**
 * @totemsdk/qvac/models — Model/asset lifecycle domain adapter (load/unload/registry/cache).
 */

import type { IntelligenceProvider } from '@totemsdk/intelligence';
import { bindDomain } from './adapter.js';
import type { QvacOp } from './adapter.js';

export const modelsDomain = 'models' as const;

export interface LoadModelParams {
  model?: string;
  params?: unknown;
}

export interface QvacModelsOps {
  loadModel: QvacOp<LoadModelParams, { id?: string; loaded?: boolean }>;
  unloadModel: QvacOp<LoadModelParams, { ok?: boolean }>;
  getModelInfo: QvacOp<Record<string, unknown>, { id?: string }>;
  getLoadedModelInfo: QvacOp<Record<string, unknown>, { id?: string; loaded?: boolean }>;
  deleteCache: QvacOp<Record<string, unknown>, { ok?: boolean }>;
  downloadAsset: QvacOp<Record<string, unknown>, unknown>;
  assessModelFit: QvacOp<Record<string, unknown>, unknown>;
  modelRegistryList: QvacOp<Record<string, unknown>, unknown>;
  modelRegistrySearch: QvacOp<Record<string, unknown>, unknown>;
  modelRegistryGetModel: QvacOp<Record<string, unknown>, unknown>;
  suspend: QvacOp<Record<string, unknown>, unknown>;
  resume: QvacOp<Record<string, unknown>, unknown>;
  state: QvacOp<Record<string, unknown>, unknown>;
}

export function modelsAdapter(provider: IntelligenceProvider): QvacModelsOps {
  return {
    loadModel: bindDomain(provider, modelsDomain, 'loadModel'),
    unloadModel: bindDomain(provider, modelsDomain, 'unloadModel'),
    getModelInfo: bindDomain(provider, modelsDomain, 'getModelInfo'),
    getLoadedModelInfo: bindDomain(provider, modelsDomain, 'getLoadedModelInfo'),
    deleteCache: bindDomain(provider, modelsDomain, 'deleteCache'),
    downloadAsset: bindDomain(provider, modelsDomain, 'downloadAsset'),
    assessModelFit: bindDomain(provider, modelsDomain, 'assessModelFit'),
    modelRegistryList: bindDomain(provider, modelsDomain, 'modelRegistryList'),
    modelRegistrySearch: bindDomain(provider, modelsDomain, 'modelRegistrySearch'),
    modelRegistryGetModel: bindDomain(provider, modelsDomain, 'modelRegistryGetModel'),
    suspend: bindDomain(provider, modelsDomain, 'suspend'),
    resume: bindDomain(provider, modelsDomain, 'resume'),
    state: bindDomain(provider, modelsDomain, 'state'),
  };
}