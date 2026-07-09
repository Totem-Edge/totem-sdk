/**
 * SDK Migration Manager
 * 
 * Manages feature flags and rollout configuration for SDK migration.
 * Controls whether wallet initialization uses SDK or legacy code paths.
 * 
 * Features:
 * - Staged rollout support (internal → canary % → full)
 * - Automatic rollback on error thresholds
 * - Telemetry tracking for rollout monitoring
 * - Manual override support for debugging
 */

import { STORAGE_KEYS } from './constants';

export type SdkInitMode = 'sdk' | 'legacy' | 'auto';
export type RolloutGroup = 'internal' | 'canary' | 'production' | 'disabled';

export interface SdkMigrationConfig {
  initMode: SdkInitMode;
  rolloutGroup: RolloutGroup;
  disabledReason?: string;
  disabledAt?: number;
  errorCount: number;
  lastError?: string;
}

export interface SdkTelemetryEvent {
  type: 'init_start' | 'init_success' | 'init_failure' | 'rollback' | 'mode_switch';
  mode: SdkInitMode;
  timestamp: number;
  duration?: number;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface SdkTelemetryState {
  events: SdkTelemetryEvent[];
  sessionStart: number;
  initSuccessCount: number;
  initFailureCount: number;
  lastMode: SdkInitMode;
}

const AUTO_ROLLBACK_THRESHOLD = {
  errorCount: 3,
  timeWindowMs: 60 * 60 * 1000,
  cooldownMs: 24 * 60 * 60 * 1000,
};

const CANARY_PERCENTAGE = 10;

export class SdkMigrationManager {
  private static cachedConfig: SdkMigrationConfig | null = null;
  private static cachedTelemetry: SdkTelemetryState | null = null;

  static async getConfig(): Promise<SdkMigrationConfig> {
    const result = await chrome.storage.local.get([
      STORAGE_KEYS.SDK_INIT_MODE,
      STORAGE_KEYS.SDK_ROLLOUT_GROUP,
      STORAGE_KEYS.SDK_DISABLED_REASON,
      STORAGE_KEYS.SDK_DISABLED_AT,
      STORAGE_KEYS.SDK_ERROR_COUNT,
      STORAGE_KEYS.SDK_LAST_ERROR,
    ]);

    const config: SdkMigrationConfig = {
      initMode: (result[STORAGE_KEYS.SDK_INIT_MODE] as SdkInitMode) || 'auto',
      rolloutGroup: (result[STORAGE_KEYS.SDK_ROLLOUT_GROUP] as RolloutGroup) || 'production',
      disabledReason: result[STORAGE_KEYS.SDK_DISABLED_REASON],
      disabledAt: result[STORAGE_KEYS.SDK_DISABLED_AT],
      errorCount: result[STORAGE_KEYS.SDK_ERROR_COUNT] || 0,
      lastError: result[STORAGE_KEYS.SDK_LAST_ERROR],
    };

    this.cachedConfig = config;
    return config;
  }

  static async setConfig(config: Partial<SdkMigrationConfig>): Promise<void> {
    const updates: Record<string, unknown> = {};

    if (config.initMode !== undefined) {
      updates[STORAGE_KEYS.SDK_INIT_MODE] = config.initMode;
    }
    if (config.rolloutGroup !== undefined) {
      updates[STORAGE_KEYS.SDK_ROLLOUT_GROUP] = config.rolloutGroup;
    }
    if (config.disabledReason !== undefined) {
      updates[STORAGE_KEYS.SDK_DISABLED_REASON] = config.disabledReason;
    }
    if (config.disabledAt !== undefined) {
      updates[STORAGE_KEYS.SDK_DISABLED_AT] = config.disabledAt;
    }
    if (config.errorCount !== undefined) {
      updates[STORAGE_KEYS.SDK_ERROR_COUNT] = config.errorCount;
    }
    if (config.lastError !== undefined) {
      updates[STORAGE_KEYS.SDK_LAST_ERROR] = config.lastError;
    }

    await chrome.storage.local.set(updates);
    this.cachedConfig = null;

    console.log('[SdkMigration] Config updated:', config);
  }

  static async shouldUseSdk(): Promise<boolean> {
    const config = await this.getConfig();

    if (config.initMode === 'legacy') {
      return false;
    }

    if (config.initMode === 'sdk') {
      return true;
    }

    if (config.disabledAt) {
      const cooldownRemaining = config.disabledAt + AUTO_ROLLBACK_THRESHOLD.cooldownMs - Date.now();
      if (cooldownRemaining > 0) {
        console.log('[SdkMigration] SDK disabled, cooldown remaining:', Math.round(cooldownRemaining / 1000 / 60), 'minutes');
        return false;
      }
      await this.clearDisabled();
    }

    switch (config.rolloutGroup) {
      case 'disabled':
        return false;
      case 'internal':
        return true;
      case 'canary':
        return this.isInCanaryGroup();
      case 'production':
        return true;
      default:
        return false;
    }
  }

  static async getEffectiveMode(): Promise<'sdk' | 'legacy'> {
    const shouldUse = await this.shouldUseSdk();
    return shouldUse ? 'sdk' : 'legacy';
  }

  private static isInCanaryGroup(): boolean {
    const installId = this.getInstallId();
    const hash = this.simpleHash(installId);
    const bucket = hash % 100;
    return bucket < CANARY_PERCENTAGE;
  }

  private static getInstallId(): string {
    try {
      return chrome.runtime.id || 'unknown';
    } catch {
      return 'unknown';
    }
  }

  private static simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  static async recordError(error: string): Promise<void> {
    const config = await this.getConfig();
    const newErrorCount = config.errorCount + 1;

    await this.setConfig({
      errorCount: newErrorCount,
      lastError: error,
    });

    await this.trackEvent({
      type: 'init_failure',
      mode: config.initMode,
      timestamp: Date.now(),
      error,
    });

    if (newErrorCount >= AUTO_ROLLBACK_THRESHOLD.errorCount) {
      await this.triggerAutoRollback(`Error threshold exceeded: ${newErrorCount} errors`);
    }
  }

  static async recordSuccess(duration: number): Promise<void> {
    const config = await this.getConfig();

    await this.setConfig({
      errorCount: 0,
      lastError: undefined,
    });

    await this.trackEvent({
      type: 'init_success',
      mode: config.initMode,
      timestamp: Date.now(),
      duration,
    });
  }

  static async triggerAutoRollback(reason: string): Promise<void> {
    console.warn('[SdkMigration] Auto-rollback triggered:', reason);

    await this.setConfig({
      disabledReason: reason,
      disabledAt: Date.now(),
      errorCount: 0,
    });

    await this.trackEvent({
      type: 'rollback',
      mode: 'legacy',
      timestamp: Date.now(),
      metadata: { reason, automatic: true },
    });
  }

  static async manualRollback(reason: string): Promise<void> {
    console.log('[SdkMigration] Manual rollback:', reason);

    await this.setConfig({
      initMode: 'legacy',
      disabledReason: reason,
      disabledAt: Date.now(),
    });

    await this.trackEvent({
      type: 'rollback',
      mode: 'legacy',
      timestamp: Date.now(),
      metadata: { reason, automatic: false },
    });
  }

  static async enableSdk(): Promise<void> {
    await this.setConfig({
      initMode: 'sdk',
      disabledReason: undefined,
      disabledAt: undefined,
      errorCount: 0,
    });

    await this.trackEvent({
      type: 'mode_switch',
      mode: 'sdk',
      timestamp: Date.now(),
    });
  }

  static async clearDisabled(): Promise<void> {
    await chrome.storage.local.remove([
      STORAGE_KEYS.SDK_DISABLED_REASON,
      STORAGE_KEYS.SDK_DISABLED_AT,
      STORAGE_KEYS.SDK_ERROR_COUNT,
      STORAGE_KEYS.SDK_LAST_ERROR,
    ]);
    this.cachedConfig = null;
  }

  static async setRolloutGroup(group: RolloutGroup): Promise<void> {
    await this.setConfig({ rolloutGroup: group });
    console.log('[SdkMigration] Rollout group set to:', group);
  }

  static async getTelemetry(): Promise<SdkTelemetryState> {
    if (this.cachedTelemetry) {
      return this.cachedTelemetry;
    }

    const result = await chrome.storage.local.get(STORAGE_KEYS.SDK_TELEMETRY);
    const stored = result[STORAGE_KEYS.SDK_TELEMETRY] as SdkTelemetryState | undefined;

    const telemetry: SdkTelemetryState = stored || {
      events: [],
      sessionStart: Date.now(),
      initSuccessCount: 0,
      initFailureCount: 0,
      lastMode: 'auto',
    };

    this.cachedTelemetry = telemetry;
    return telemetry;
  }

  static async trackEvent(event: SdkTelemetryEvent): Promise<void> {
    const telemetry = await this.getTelemetry();

    telemetry.events.push(event);
    
    if (telemetry.events.length > 100) {
      telemetry.events = telemetry.events.slice(-100);
    }

    if (event.type === 'init_success') {
      telemetry.initSuccessCount++;
    } else if (event.type === 'init_failure') {
      telemetry.initFailureCount++;
    }

    if (event.mode !== 'auto') {
      telemetry.lastMode = event.mode;
    }

    this.cachedTelemetry = telemetry;
    await chrome.storage.local.set({
      [STORAGE_KEYS.SDK_TELEMETRY]: telemetry,
    });
  }

  static async getStats(): Promise<{
    successRate: number;
    totalInits: number;
    currentMode: SdkInitMode;
    rolloutGroup: RolloutGroup;
    isDisabled: boolean;
    errorCount: number;
  }> {
    const config = await this.getConfig();
    const telemetry = await this.getTelemetry();
    const total = telemetry.initSuccessCount + telemetry.initFailureCount;

    return {
      successRate: total > 0 ? telemetry.initSuccessCount / total : 1,
      totalInits: total,
      currentMode: config.initMode,
      rolloutGroup: config.rolloutGroup,
      isDisabled: !!config.disabledAt,
      errorCount: config.errorCount,
    };
  }

  static async reset(): Promise<void> {
    await chrome.storage.local.remove([
      STORAGE_KEYS.SDK_INIT_MODE,
      STORAGE_KEYS.SDK_ROLLOUT_GROUP,
      STORAGE_KEYS.SDK_DISABLED_REASON,
      STORAGE_KEYS.SDK_DISABLED_AT,
      STORAGE_KEYS.SDK_ERROR_COUNT,
      STORAGE_KEYS.SDK_LAST_ERROR,
      STORAGE_KEYS.SDK_TELEMETRY,
    ]);

    this.cachedConfig = null;
    this.cachedTelemetry = null;

    console.log('[SdkMigration] Reset to defaults');
  }

  static watch(callback: (config: SdkMigrationConfig) => void): void {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== 'local') return;

      const relevantKeys = [
        STORAGE_KEYS.SDK_INIT_MODE,
        STORAGE_KEYS.SDK_ROLLOUT_GROUP,
        STORAGE_KEYS.SDK_DISABLED_REASON,
        STORAGE_KEYS.SDK_DISABLED_AT,
      ];

      const hasRelevantChange = relevantKeys.some((key) => key in changes);

      if (hasRelevantChange) {
        this.cachedConfig = null;
        this.getConfig().then(callback).catch(console.error);
      }
    });
  }
}
