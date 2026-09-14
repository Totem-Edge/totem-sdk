/**
 * @totemsdk/qvac/world — Simulated-world domain adapter (worldCreateScene / worldStep).
 */

import type { IntelligenceProvider } from '@totemsdk/intelligence';
import { bindDomain } from './adapter.js';
import type { QvacOp } from './adapter.js';

export const worldDomain = 'world' as const;

export interface WorldCreateSceneParams {
  name?: string;
  config?: unknown;
}

export interface WorldStepParams {
  action?: unknown;
  sceneId?: string;
}

export interface QvacWorldOps {
  worldCreateScene: QvacOp<WorldCreateSceneParams, { sceneId?: string }>;
  worldStep: QvacOp<WorldStepParams, unknown>;
}

export function worldAdapter(provider: IntelligenceProvider): QvacWorldOps {
  return {
    worldCreateScene: bindDomain(provider, worldDomain, 'worldCreateScene'),
    worldStep: bindDomain(provider, worldDomain, 'worldStep'),
  };
}