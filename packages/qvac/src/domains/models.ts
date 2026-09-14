/**
 * @totemsdk/qvac/models — Model/asset lifecycle domain adapter (load/unload/registry/cache).
 *
 * `loadModel` / `downloadAsset` resolve to strings but carry a synchronous
 * upstream `requestId` (decorated promises) which the provider forwards on
 * `cancel({ requestId })`. `modelRegistryGetModel` is POSITIONAL upstream and
 * is surfaced as an explicit wrapper.
 */

import type { IntelligenceOutcome, IntelligenceProvider } from '@totemsdk/intelligence';
import { bindDomain, bindPositional } from './adapter.js';
import type { QvacOp } from './adapter.js';

import type {
  AssessModelFitInput,
  AssessModelFitResult,
  DownloadAssetOptions,
  GetLoadedModelInfoParams,
  GetModelInfoParams,
  LoadedModelInfo,
  LoadModelOptions,
  ModelInfo,
  ModelRegistryEntry,
  ModelRegistrySearchParams,
} from '@qvac/sdk';

export const modelsDomain = 'models' as const;

export type {
  AssessModelFitInput,
  AssessModelFitResult,
  DownloadAssetOptions,
  GetLoadedModelInfoParams,
  GetModelInfoParams,
  LoadedModelInfo,
  LoadModelOptions,
  ModelInfo,
  ModelRegistryEntry,
  ModelRegistryEntryAddon,
  ModelRegistrySearchParams,
} from '@qvac/sdk';

export type DeleteCacheParams = { all: true } | { kvCacheKey: string; modelId?: string };

export interface QvacModelsOps {
  loadModel: QvacOp<LoadModelOptions, string>;
  unloadModel: QvacOp<{ modelId: string }, void>;
  getModelInfo: QvacOp<GetModelInfoParams, ModelInfo>;
  getLoadedModelInfo: QvacOp<GetLoadedModelInfoParams, LoadedModelInfo>;
  deleteCache: QvacOp<DeleteCacheParams, { success: boolean }>;
  downloadAsset: QvacOp<DownloadAssetOptions, string>;
  assessModelFit: QvacOp<AssessModelFitInput, AssessModelFitResult>;
  modelRegistryList: QvacOp<Record<string, never>, ModelRegistryEntry[]>;
  modelRegistrySearch: QvacOp<ModelRegistrySearchParams, ModelRegistryEntry[]>;
  /**
   * Real upstream signature: positional `(registryPath, registrySource)`.
   */
  modelRegistryGetModel: (
    registryPath: string,
    registrySource: string,
  ) => Promise<IntelligenceOutcome<ModelRegistryEntry>>;
  suspend: QvacOp<Record<string, never>, void>;
  resume: QvacOp<Record<string, never>, void>;
  state: QvacOp<Record<string, never>, unknown>;
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
    modelRegistryGetModel: bindPositional<[string, string], ModelRegistryEntry>(
      provider, modelsDomain, 'modelRegistryGetModel', ['registryPath', 'registrySource'],
    ),
    suspend: bindDomain(provider, modelsDomain, 'suspend'),
    resume: bindDomain(provider, modelsDomain, 'resume'),
    state: bindDomain(provider, modelsDomain, 'state'),
  };
}