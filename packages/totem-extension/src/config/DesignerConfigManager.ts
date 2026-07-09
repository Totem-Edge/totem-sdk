/**
 * Designer Config Manager
 * 
 * Manages configuration for Designer mode Live Testing.
 * Translates designer_* storage keys into AXIA_* keys consumed by AxiaRpcClient.
 */

import { STORAGE_KEYS, ENV } from './constants';

export type DesignerMode = 'mock' | 'live';

export interface DesignerConfig {
  mode: DesignerMode;
  apiUrl?: string;
  projectId?: string;
}

export class DesignerConfigManager {
  /**
   * Get current Designer mode configuration from storage
   */
  static async getConfig(): Promise<DesignerConfig> {
    const result = await chrome.storage.local.get([
      STORAGE_KEYS.DESIGNER_MODE,
      STORAGE_KEYS.DESIGNER_API_URL,
      STORAGE_KEYS.DESIGNER_PROJECT_ID,
    ]);

    return {
      mode: (result[STORAGE_KEYS.DESIGNER_MODE] as DesignerMode) || 'mock',
      apiUrl: result[STORAGE_KEYS.DESIGNER_API_URL] || ENV.AXIA_API_URL || '',
      projectId: result[STORAGE_KEYS.DESIGNER_PROJECT_ID] || ENV.AXIA_PROJECT_ID || '',
    };
  }

  /**
   * Set Designer mode configuration
   * This updates both designer_* keys and canonical AXIA_* keys
   */
  static async setConfig(config: Partial<DesignerConfig>): Promise<void> {
    const updates: Record<string, any> = {};

    if (config.mode !== undefined) {
      updates[STORAGE_KEYS.DESIGNER_MODE] = config.mode;
    }

    if (config.apiUrl !== undefined) {
      updates[STORAGE_KEYS.DESIGNER_API_URL] = config.apiUrl;
    }

    if (config.projectId !== undefined) {
      updates[STORAGE_KEYS.DESIGNER_PROJECT_ID] = config.projectId;
    }

    // Store designer-specific keys
    await chrome.storage.local.set(updates);

    // Synchronize with canonical keys for AxiaRpcClient
    await this.synchronizeToAxiaKeys();
  }

  /**
   * Synchronize designer_* keys to AXIA_* keys
   * This ensures AxiaRpcClient sees the correct configuration
   * 
   * CRITICAL: Must use AXIA_BASE (not AXIA_BASE_URL) to match AxiaRpcClient.loadBootstrapConfig()
   */
  static async synchronizeToAxiaKeys(): Promise<void> {
    const config = await this.getConfig();

    // Only update AXIA keys in Live mode
    if (config.mode === 'live' && config.apiUrl && config.projectId) {
      const updates: Record<string, any> = {
        AXIA_BASE: config.apiUrl,  // CRITICAL: Must be AXIA_BASE, not AXIA_BASE_URL
        AXIA_PROJECT_ID: config.projectId,
      };

      await chrome.storage.local.set(updates);
      console.log('[DesignerConfig] Synchronized to AXIA keys:', {
        baseUrl: config.apiUrl,
        projectId: config.projectId,
      });
    } else if (config.mode === 'mock') {
      // In mock mode, clear AXIA keys to prevent accidental API calls
      await chrome.storage.local.remove(['AXIA_BASE', 'AXIA_PROJECT_ID']);
      console.log('[DesignerConfig] Mock mode - cleared AXIA keys');
    }
  }

  /**
   * Get effective Axia API configuration
   * Returns the configuration that AxiaRpcClient should use
   * 
   * Priority:
   * 1. Environment variables (highest)
   * 2. Designer Live mode overrides
   * 3. Default bootstrap config (fallback)
   */
  static async getEffectiveConfig(): Promise<{
    baseUrl: string;
    projectId: string;
    isLive: boolean;
  }> {
    const config = await this.getConfig();

    // Priority 1: Environment variables
    if (ENV.AXIA_API_URL && ENV.AXIA_PROJECT_ID) {
      return {
        baseUrl: ENV.AXIA_API_URL,
        projectId: ENV.AXIA_PROJECT_ID,
        isLive: true,
      };
    }

    // Priority 2: Designer Live mode
    if (config.mode === 'live' && config.apiUrl && config.projectId) {
      return {
        baseUrl: config.apiUrl,
        projectId: config.projectId,
        isLive: true,
      };
    }

    // Priority 3: Default (mock mode or no config)
    return {
      baseUrl: 'https://api.axia.to', // Default
      projectId: '',
      isLive: false,
    };
  }

  /**
   * Check if currently in Live Testing mode
   */
  static async isLiveMode(): Promise<boolean> {
    const config = await this.getConfig();
    return config.mode === 'live';
  }

  /**
   * Reset to default (mock) configuration
   */
  static async reset(): Promise<void> {
    await chrome.storage.local.remove([
      STORAGE_KEYS.DESIGNER_MODE,
      STORAGE_KEYS.DESIGNER_API_URL,
      STORAGE_KEYS.DESIGNER_PROJECT_ID,
      'AXIA_BASE',  // CRITICAL: Must be AXIA_BASE, not AXIA_BASE_URL
      'AXIA_PROJECT_ID',
    ]);

    console.log('[DesignerConfig] Reset to defaults (mock mode)');
  }

  /**
   * Watch for configuration changes
   * Callback is triggered whenever Designer config changes
   */
  static watch(callback: (config: DesignerConfig) => void): void {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== 'local') return;

      const relevantKeys = [
        STORAGE_KEYS.DESIGNER_MODE,
        STORAGE_KEYS.DESIGNER_API_URL,
        STORAGE_KEYS.DESIGNER_PROJECT_ID,
      ];

      const hasRelevantChange = relevantKeys.some((key) => key in changes);

      if (hasRelevantChange) {
        this.getConfig().then(callback).catch(console.error);
      }
    });
  }
}
