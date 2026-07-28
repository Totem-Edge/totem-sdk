/**
 * Totem Wallet Extension Constants
 * 
 * Centralized configuration values used across the extension.
 */

/**
 * DESIGNER MODE CONFIGURATION
 * 
 * Designer mode allows development and testing of the wallet UI
 * without a background service worker (dev-popup.html).
 */
export const DESIGNER_MODE_EXTENSION_ID = 'totem-dev-extension-id';

/**
 * Check if the extension is running in Designer mode.
 * 
 * Designer mode is active when:
 * 1. chrome is undefined (Vite dev server before mock API loads)
 * 2. chrome.runtime is undefined (no background service)
 * 3. chrome.runtime.id matches DESIGNER_MODE_EXTENSION_ID
 * 
 * Production Safety: Designer mode is ALWAYS false in production builds via webpack
 * Webpack defines `process.env.NODE_ENV` at build time for tree-shaking
 * 
 * @returns true if running in Designer mode (always false in production)
 */
export function isDesignerMode(): boolean {
  // Production Safety: ALWAYS return false in production builds
  // __DESIGNER_MODE__ is a compile-time constant injected by webpack DefinePlugin
  // Production builds have this set to false, enabling tree-shaking of Designer code
  if (!__DESIGNER_MODE__) {
    return false;
  }
  
  // Designer mode is active when chrome or chrome.runtime is missing
  if (typeof chrome === 'undefined' || !chrome?.runtime) {
    if (typeof window !== 'undefined') {
      console.warn('[Totem] 🔧 Designer mode active - chrome.runtime not available (Vite dev server)');
    }
    return true;
  }
  
  const runtimeId = chrome.runtime.id;
  const isDesigner = !runtimeId || runtimeId === DESIGNER_MODE_EXTENSION_ID;
  
  // Production safety log: warn if Designer mode is accidentally triggered
  if (isDesigner && typeof window !== 'undefined') {
    console.warn('[Totem] 🔧 Designer mode active - background service worker bypassed');
  }
  
  return isDesigner;
}

/**
 * STORAGE KEYS
 * 
 * Keys used in chrome.storage.local for wallet data persistence.
 */
export const STORAGE_KEYS = {
  WALLET_SETUP: 'walletSetup',
  WALLET_ADDRESSES: 'walletAddresses',
  ENCRYPTED_SEED: 'encryptedSeed',
  ADDRESS_NAMES: 'addressNames',
  EXCLUDED_ADDRESSES: 'excludedAddresses',
  TOTEM_CONFIG: 'totem_config',
  
  // Designer mode configuration
  DESIGNER_MODE: 'designer_mode',
  DESIGNER_API_URL: 'designer_api_url',
  DESIGNER_PROJECT_ID: 'designer_project_id',
  
  // SDK Migration feature flags
  SDK_INIT_MODE: 'sdk_init_mode',
  SDK_ROLLOUT_GROUP: 'sdk_rollout_group',
  SDK_DISABLED_REASON: 'sdk_disabled_reason',
  SDK_DISABLED_AT: 'sdk_disabled_at',
  SDK_ERROR_COUNT: 'sdk_error_count',
  SDK_LAST_ERROR: 'sdk_last_error',
  SDK_TELEMETRY: 'sdk_telemetry',
} as const;

/**
 * ENVIRONMENT VARIABLES
 * 
 * Configuration from .env.local for Designer mode live testing.
 * These are only available in development mode.
 */
export const ENV = {
  /**
   * Get Axia API URL from environment or empty string
   * Only available in Designer mode (dev-popup.html via Vite)
   */
  get AXIA_API_URL(): string {
    try {
      // @ts-ignore - Vite injects import.meta.env at build time
      return import.meta?.env?.VITE_AXIA_API_URL || '';
    } catch {
      return '';
    }
  },
  
  /**
   * Get Axia Project ID from environment or empty string
   * Only available in Designer mode (dev-popup.html via Vite)
   */
  get AXIA_PROJECT_ID(): string {
    try {
      // @ts-ignore - Vite injects import.meta.env at build time
      return import.meta?.env?.VITE_AXIA_PROJECT_ID || '';
    } catch {
      return '';
    }
  },
} as const;
