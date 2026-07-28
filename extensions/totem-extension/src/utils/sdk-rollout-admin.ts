/**
 * SDK Rollout Admin Utilities
 * 
 * Helper functions for managing SDK migration rollout from the browser console.
 * These are development/admin tools and should not be used in production UI.
 */

import { SdkMigrationManager, RolloutGroup, SdkInitMode } from '../config/SdkMigrationManager';

export interface RolloutStatus {
  currentGroup: RolloutGroup;
  currentMode: SdkInitMode;
  effectiveMode: 'sdk' | 'legacy';
  isInCanaryBucket: boolean;
  isAutoRollbackActive: boolean;
  cooldownRemainingMs: number | null;
  errorCount: number;
  lastError: string | null;
  successRate: number;
  totalInits: number;
}

export async function getRolloutStatus(): Promise<RolloutStatus> {
  const config = await SdkMigrationManager.getConfig();
  const stats = await SdkMigrationManager.getStats();
  const effectiveMode = await SdkMigrationManager.getEffectiveMode();

  let cooldownRemainingMs: number | null = null;
  if (config.disabledAt) {
    const COOLDOWN_MS = 24 * 60 * 60 * 1000;
    const remaining = config.disabledAt + COOLDOWN_MS - Date.now();
    cooldownRemainingMs = remaining > 0 ? remaining : null;
  }

  const installId = chrome.runtime?.id || 'unknown';
  let hash = 0;
  for (let i = 0; i < installId.length; i++) {
    const char = installId.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  const isInCanaryBucket = (Math.abs(hash) % 100) < 10;

  return {
    currentGroup: config.rolloutGroup,
    currentMode: config.initMode,
    effectiveMode,
    isInCanaryBucket,
    isAutoRollbackActive: !!config.disabledAt && cooldownRemainingMs !== null,
    cooldownRemainingMs,
    errorCount: config.errorCount,
    lastError: config.lastError || null,
    successRate: stats.successRate,
    totalInits: stats.totalInits,
  };
}

export async function setRolloutGroup(group: RolloutGroup): Promise<void> {
  await SdkMigrationManager.setRolloutGroup(group);
  console.log(`[SDK Rollout] Group set to: ${group}`);
}

export async function forceMode(mode: SdkInitMode): Promise<void> {
  if (mode === 'sdk') {
    await SdkMigrationManager.enableSdk();
  } else if (mode === 'legacy') {
    await SdkMigrationManager.manualRollback('Admin forced legacy mode');
  } else {
    await SdkMigrationManager.setConfig({ initMode: 'auto' });
    await SdkMigrationManager.clearDisabled();
  }
  console.log(`[SDK Rollout] Mode forced to: ${mode}`);
}

export async function clearAutoRollback(): Promise<void> {
  await SdkMigrationManager.clearDisabled();
  console.log('[SDK Rollout] Auto-rollback cleared');
}

export async function resetRollout(): Promise<void> {
  await SdkMigrationManager.reset();
  console.log('[SDK Rollout] Reset to defaults');
}

export async function progressRollout(): Promise<RolloutGroup> {
  const config = await SdkMigrationManager.getConfig();
  
  const progression: Record<RolloutGroup, RolloutGroup> = {
    disabled: 'internal',
    internal: 'canary',
    canary: 'production',
    production: 'production',
  };

  const nextGroup = progression[config.rolloutGroup];
  
  if (nextGroup !== config.rolloutGroup) {
    await SdkMigrationManager.setRolloutGroup(nextGroup);
    console.log(`[SDK Rollout] Progressed: ${config.rolloutGroup} → ${nextGroup}`);
  } else {
    console.log('[SDK Rollout] Already at production level');
  }

  return nextGroup;
}

export async function regressRollout(): Promise<RolloutGroup> {
  const config = await SdkMigrationManager.getConfig();
  
  const regression: Record<RolloutGroup, RolloutGroup> = {
    disabled: 'disabled',
    internal: 'disabled',
    canary: 'internal',
    production: 'canary',
  };

  const prevGroup = regression[config.rolloutGroup];
  
  if (prevGroup !== config.rolloutGroup) {
    await SdkMigrationManager.setRolloutGroup(prevGroup);
    console.log(`[SDK Rollout] Regressed: ${config.rolloutGroup} → ${prevGroup}`);
  } else {
    console.log('[SDK Rollout] Already at disabled level');
  }

  return prevGroup;
}

export function printRolloutHelp(): void {
  console.log(`
SDK Rollout Admin Commands:
===========================

Get current status:
  window.sdkRollout.status()

Set rollout group:
  window.sdkRollout.setGroup('disabled')
  window.sdkRollout.setGroup('internal')
  window.sdkRollout.setGroup('canary')
  window.sdkRollout.setGroup('production')

Force mode:
  window.sdkRollout.forceMode('sdk')
  window.sdkRollout.forceMode('legacy')
  window.sdkRollout.forceMode('auto')

Progress/regress rollout:
  window.sdkRollout.progress()
  window.sdkRollout.regress()

Clear auto-rollback:
  window.sdkRollout.clearAutoRollback()

Reset to defaults:
  window.sdkRollout.reset()
`);
}

export const sdkRolloutAdmin = {
  status: getRolloutStatus,
  setGroup: setRolloutGroup,
  forceMode,
  progress: progressRollout,
  regress: regressRollout,
  clearAutoRollback,
  reset: resetRollout,
  help: printRolloutHelp,
};

if (typeof window !== 'undefined') {
  (window as any).sdkRollout = sdkRolloutAdmin;
}
