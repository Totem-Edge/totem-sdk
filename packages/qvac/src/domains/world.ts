/**
 * @totemsdk/qvac/world — Simulated-world domain adapter (worldCreateScene / worldStep).
 */

import type { IntelligenceProvider } from '@totemsdk/intelligence';
import { bindDomain } from './adapter.js';
import type { QvacOp } from './adapter.js';

import type {
  WorldSceneClientParams,
  WorldSceneResult,
  WorldSceneResultWithPack,
  WorldStepClientParams,
  WorldStepProgressTick,
  WorldStepResult,
} from '@qvac/sdk';

export const worldDomain = 'world' as const;

export type {
  WorldSceneClientParams,
  WorldSceneResult,
  WorldSceneResultWithPack,
  WorldStepClientParams,
  WorldStepProgressTick,
  WorldStepResult,
} from '@qvac/sdk';

export type WorldCreateSceneResult = WorldSceneResult | WorldSceneResultWithPack;

export interface QvacWorldOps {
  worldCreateScene: QvacOp<WorldSceneClientParams, WorldCreateSceneResult>;
  worldStep: QvacOp<WorldStepClientParams, WorldStepResult>;
}

export function worldAdapter(provider: IntelligenceProvider): QvacWorldOps {
  return {
    worldCreateScene: bindDomain(provider, worldDomain, 'worldCreateScene'),
    worldStep: bindDomain(provider, worldDomain, 'worldStep'),
  };
}