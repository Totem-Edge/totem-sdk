/**
 * @module FeatureFlags
 * Feature flag infrastructure for SDK migration safety
 * 
 * Provides:
 * - walletInitMode toggle between legacy and SDK initialization
 * - Telemetry integration for monitoring error rates
 * - Automatic rollback if error rate exceeds threshold
 */

import { track } from '../../telemetry';

export type WalletInitMode = 'legacy' | 'sdk';

export interface FeatureFlagConfig {
  walletInitMode: WalletInitMode;
  sdkErrorThreshold: number;
  sdkErrorWindowMs: number;
  enableAutoRollback: boolean;
}

export interface InitTelemetryEvent {
  mode: WalletInitMode;
  durationMs: number;
  success: boolean;
  errorType?: string;
  errorMessage?: string;
}

const DEFAULT_CONFIG: FeatureFlagConfig = {
  walletInitMode: 'sdk',
  sdkErrorThreshold: 5,
  sdkErrorWindowMs: 60_000,
  enableAutoRollback: true,
};

const STORAGE_KEY = 'totem_feature_flags';
const INIT_TELEMETRY_KEY = 'totem_init_telemetry';

interface InitTelemetryWindow {
  errors: number;
  lastReset: number;
  lastError?: string;
  lastErrorTime?: number;
}

class FeatureFlagsManager {
  private config: FeatureFlagConfig = { ...DEFAULT_CONFIG };
  private initialized = false;
  private telemetryWindow: InitTelemetryWindow = {
    errors: 0,
    lastReset: Date.now(),
  };
  private listeners = new Set<(config: FeatureFlagConfig) => void>();

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        const result = await chrome.storage.local.get([STORAGE_KEY, INIT_TELEMETRY_KEY]);
        
        if (result[STORAGE_KEY]) {
          this.config = { ...DEFAULT_CONFIG, ...result[STORAGE_KEY] };
        }
        
        if (result[INIT_TELEMETRY_KEY]) {
          this.telemetryWindow = result[INIT_TELEMETRY_KEY];
          this.maybeResetWindow();
        }
      }
    } catch (error) {
      console.warn('[FeatureFlags] Failed to load from storage:', error);
    }

    this.initialized = true;
  }

  private maybeResetWindow(): void {
    const now = Date.now();
    if (now - this.telemetryWindow.lastReset > this.config.sdkErrorWindowMs) {
      this.telemetryWindow = { errors: 0, lastReset: now };
    }
  }

  async setWalletInitMode(mode: WalletInitMode): Promise<void> {
    this.config.walletInitMode = mode;
    await this.persistConfig();
    this.notifyListeners();
    
    track({
      project_id: 'totem-extension',
      method: 'feature_flag_change',
      client_version: process.env.TOTEM_VERSION || '1.0.0',
      platform: 'chrome',
      outcome: 'ok',
    });
  }

  getWalletInitMode(): WalletInitMode {
    if (!this.initialized) {
      console.warn('[FeatureFlags] Not initialized, returning default mode');
      return DEFAULT_CONFIG.walletInitMode;
    }
    return this.config.walletInitMode;
  }

  isSDKModeEnabled(): boolean {
    return this.getWalletInitMode() === 'sdk';
  }

  getConfig(): Readonly<FeatureFlagConfig> {
    return { ...this.config };
  }

  async updateConfig(partial: Partial<FeatureFlagConfig>): Promise<void> {
    this.config = { ...this.config, ...partial };
    await this.persistConfig();
    this.notifyListeners();
  }

  onConfigChange(callback: (config: FeatureFlagConfig) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  async trackInitialization(event: InitTelemetryEvent): Promise<void> {
    track({
      project_id: 'totem-extension',
      method: `wallet_init_${event.mode}`,
      client_version: process.env.TOTEM_VERSION || '1.0.0',
      platform: 'chrome',
      latency_ms: event.durationMs,
      outcome: event.success ? 'ok' : 'error',
      error_class: event.success ? undefined : this.classifyError(event.errorType),
    });

    if (!event.success && event.mode === 'sdk') {
      await this.recordSDKError(event.errorMessage);
    }
  }

  private async recordSDKError(errorMessage?: string): Promise<void> {
    this.maybeResetWindow();
    
    this.telemetryWindow.errors++;
    this.telemetryWindow.lastError = errorMessage;
    this.telemetryWindow.lastErrorTime = Date.now();

    await this.persistTelemetryWindow();

    if (this.config.enableAutoRollback && this.shouldAutoRollback()) {
      console.warn('[FeatureFlags] SDK error threshold exceeded, rolling back to legacy mode');
      await this.performAutoRollback();
    }
  }

  private shouldAutoRollback(): boolean {
    return this.telemetryWindow.errors >= this.config.sdkErrorThreshold;
  }

  private async performAutoRollback(): Promise<void> {
    await this.setWalletInitMode('legacy');
    
    this.telemetryWindow = { errors: 0, lastReset: Date.now() };
    await this.persistTelemetryWindow();

    track({
      project_id: 'totem-extension',
      method: 'sdk_auto_rollback',
      client_version: process.env.TOTEM_VERSION || '1.0.0',
      platform: 'chrome',
      outcome: 'ok',
    });
  }

  async manualRollback(): Promise<void> {
    await this.setWalletInitMode('legacy');
    
    this.telemetryWindow = { errors: 0, lastReset: Date.now() };
    await this.persistTelemetryWindow();

    track({
      project_id: 'totem-extension',
      method: 'sdk_manual_rollback',
      client_version: process.env.TOTEM_VERSION || '1.0.0',
      platform: 'chrome',
      outcome: 'ok',
    });
  }

  getErrorStats(): { errors: number; windowMs: number; threshold: number } {
    this.maybeResetWindow();
    return {
      errors: this.telemetryWindow.errors,
      windowMs: this.config.sdkErrorWindowMs,
      threshold: this.config.sdkErrorThreshold,
    };
  }

  private classifyError(errorType?: string): 'client' | 'server' | 'other' {
    if (!errorType) return 'other';
    
    const type = errorType.toLowerCase();
    if (type.includes('network') || type.includes('fetch') || type.includes('timeout')) {
      return 'server';
    }
    if (type.includes('storage') || type.includes('parse') || type.includes('type')) {
      return 'client';
    }
    return 'other';
  }

  private async persistConfig(): Promise<void> {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        await chrome.storage.local.set({ [STORAGE_KEY]: this.config });
      }
    } catch (error) {
      console.error('[FeatureFlags] Failed to persist config:', error);
    }
  }

  private async persistTelemetryWindow(): Promise<void> {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        await chrome.storage.local.set({ [INIT_TELEMETRY_KEY]: this.telemetryWindow });
      }
    } catch (error) {
      console.error('[FeatureFlags] Failed to persist telemetry window:', error);
    }
  }

  private notifyListeners(): void {
    const config = this.getConfig();
    this.listeners.forEach(callback => callback(config));
  }

  async reset(): Promise<void> {
    this.config = { ...DEFAULT_CONFIG };
    this.telemetryWindow = { errors: 0, lastReset: Date.now() };
    await this.persistConfig();
    await this.persistTelemetryWindow();
    this.notifyListeners();
  }
}

export const featureFlags = new FeatureFlagsManager();

export async function withInitModeSwitch<T>(
  legacyFn: () => Promise<T>,
  sdkFn: () => Promise<T>
): Promise<T> {
  await featureFlags.initialize();
  
  const mode = featureFlags.getWalletInitMode();
  const start = performance.now ? performance.now() : Date.now();
  
  try {
    const result = mode === 'sdk' ? await sdkFn() : await legacyFn();
    const duration = (performance.now ? performance.now() : Date.now()) - start;
    
    await featureFlags.trackInitialization({
      mode,
      durationMs: duration,
      success: true,
    });
    
    return result;
  } catch (error: any) {
    const duration = (performance.now ? performance.now() : Date.now()) - start;
    
    await featureFlags.trackInitialization({
      mode,
      durationMs: duration,
      success: false,
      errorType: error?.name || 'UnknownError',
      errorMessage: error?.message || String(error),
    });
    
    throw error;
  }
}

export function useFeatureFlags() {
  return {
    getWalletInitMode: () => featureFlags.getWalletInitMode(),
    isSDKModeEnabled: () => featureFlags.isSDKModeEnabled(),
    setWalletInitMode: (mode: WalletInitMode) => featureFlags.setWalletInitMode(mode),
    getConfig: () => featureFlags.getConfig(),
    getErrorStats: () => featureFlags.getErrorStats(),
    manualRollback: () => featureFlags.manualRollback(),
    onConfigChange: (callback: (config: FeatureFlagConfig) => void) => 
      featureFlags.onConfigChange(callback),
  };
}
