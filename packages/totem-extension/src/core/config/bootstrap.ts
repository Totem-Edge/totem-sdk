/**
 * Totem Bootstrap Configuration Service
 * Fetches and validates /totem.json from Axia backend
 * Supports Designer mode overrides via DesignerConfigManager
 * 
 * Security: All RPC endpoints validated against allow-list
 */

import * as ed25519 from '@noble/ed25519';
import { sha512 } from '@noble/hashes/sha2';
import { DesignerConfigManager } from '../../config/DesignerConfigManager';
import { isDesignerMode } from '../../config/constants';
import { validateUrl, validateBootstrapConfig, logSecurityViolation } from '../security/SecurityValidator';

// Initialize SHA-512 for Ed25519 (required for browser environments)
// v2.x API: ed.hashes.sha512 enables sync methods (sign, verify, keygen)
ed25519.hashes.sha512 = sha512;

/**
 * SHA-256 fingerprint of the expected signing key DER bytes.
 * This is the ONLY value that needs updating on key rotation — it is a
 * hash, not the key itself, so it is safe to pin in the extension bundle.
 * Rotate by: 1) update Railway env vars  2) update this fingerprint  3) release.
 */
const PINNED_KEY_FINGERPRINT = '538c567a0e9675fb7308ec1fd7a52d49c2c129e66e15f41b9fe08ab7c4943b13';

/**
 * Fallback public key used when the well-known endpoint is unreachable.
 * Matches the Railway CONFIG_SIGNING_PUBLIC_KEY env var.
 */
const FALLBACK_PUBLIC_KEY = 'MCowBQYDK2VwAyEAThRXsvlEBeldGdUZP5cWYtf022B1VSK7upTTnLxd7ys=';

const PUBKEY_CACHE_KEY = 'totem_signing_pubkey';
const PUBKEY_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface BootstrapConfig {
  version: string;
  rpc_endpoint: string;
  project_id: string;
  quotas: {
    daily_requests: number;
    monthly_requests?: number;
  };
  rate_limits: {
    requests_per_minute: number;
    burst_capacity: number;
  };
  upgrade_messaging: {
    title: string;
    description: string;
    cta_text: string;
    cta_url: string;
  };
  bootstrap: {
    enabled: boolean;
    auto_update_interval_hours?: number;
  };
  signature?: string;
}

export interface StoredConfig {
  AXIA_BASE: string;
  AXIA_PROJECT_ID: string;
  config: BootstrapConfig;
  last_updated: number;
}

const DEFAULT_RPC_BASE = 'https://api.axia.to';
const CONFIG_STORAGE_KEY = 'totem_config';

// Singleflight guard for bootstrap initialization
// Prevents concurrent config fetch/validation when called multiple times
let bootstrapPromise: Promise<StoredConfig> | null = null;

/**
 * Compute SHA-256 fingerprint of a base64-encoded DER public key.
 * Used to validate a fetched key matches our pinned fingerprint.
 */
async function fingerprintKey(publicKeyBase64: string): Promise<string> {
  const derBytes = Uint8Array.from(atob(publicKeyBase64), c => c.charCodeAt(0));
  const hashBuffer = await crypto.subtle.digest('SHA-256', derBytes);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Fetch the signing public key from the backend's well-known endpoint.
 * Validates the fetched key's fingerprint against the pinned value before use.
 * Falls back to FALLBACK_PUBLIC_KEY if the endpoint is unreachable or fingerprint mismatches.
 * Result is cached in chrome.storage for PUBKEY_CACHE_TTL_MS.
 */
async function fetchAndCachePublicKey(baseUrl: string): Promise<string> {
  // Check chrome.storage cache first
  try {
    const cached = await chrome.storage.local.get(PUBKEY_CACHE_KEY);
    const entry = cached[PUBKEY_CACHE_KEY];
    if (entry && entry.publicKey && entry.cachedAt && (Date.now() - entry.cachedAt) < PUBKEY_CACHE_TTL_MS) {
      return entry.publicKey;
    }
  } catch { /* storage unavailable — continue to fetch */ }

  // Fetch from well-known endpoint
  try {
    const response = await fetch(`${baseUrl}/.well-known/totem-config-key`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    const fetchedKey: string = data.publicKey;
    const fetchedFingerprint: string = data.fingerprint;

    if (!fetchedKey || !fetchedFingerprint) throw new Error('Missing publicKey or fingerprint in response');

    // Validate fingerprint matches our pinned value
    const computedFingerprint = await fingerprintKey(fetchedKey);
    if (computedFingerprint !== PINNED_KEY_FINGERPRINT) {
      console.error('❌ Fetched key fingerprint mismatch — possible key rotation or tampering', {
        pinned: PINNED_KEY_FINGERPRINT,
        fetched: computedFingerprint,
      });
      // Key has changed. Fall back to the hardcoded key so the user isn't locked out.
      // An extension release is required to accept the new key.
      return FALLBACK_PUBLIC_KEY;
    }

    // Cache the validated key
    try {
      await chrome.storage.local.set({ [PUBKEY_CACHE_KEY]: { publicKey: fetchedKey, cachedAt: Date.now() } });
    } catch { /* non-fatal */ }

    console.log('🔑 Signing key fetched and fingerprint verified');
    return fetchedKey;
  } catch (error) {
    console.warn('⚠️ Could not fetch signing key from well-known endpoint, using fallback:', error);
    return FALLBACK_PUBLIC_KEY;
  }
}

/**
 * Verify Ed25519 signature on bootstrap config using a dynamically fetched key.
 */
async function verifySignature(config: any, signature: string, publicKeyBase64: string): Promise<boolean> {
  try {
    // Decode base64 DER public key — Ed25519 raw key is the last 32 bytes
    const publicKeyBytes = Uint8Array.from(atob(publicKeyBase64), c => c.charCodeAt(0));
    const ed25519PublicKey = publicKeyBytes.slice(-32);
    
    // Create canonical JSON for verification (exclude signature field)
    const { signature: _, ...configToVerify } = config;
    const canonicalJson = JSON.stringify(configToVerify, Object.keys(configToVerify).sort());
    
    // Decode signature from base64
    const signatureBytes = Uint8Array.from(atob(signature), c => c.charCodeAt(0));
    
    // Verify signature
    const messageBytes = new TextEncoder().encode(canonicalJson);
    return await ed25519.verify(signatureBytes, messageBytes, ed25519PublicKey);
  } catch (error) {
    console.error('❌ Signature verification error:', error);
    return false;
  }
}

/**
 * Fetch bootstrap configuration from backend
 * Security: Validates base URL against allow-list before fetching
 */
export async function fetchBootstrapConfig(baseUrl: string = DEFAULT_RPC_BASE): Promise<BootstrapConfig> {
  // Security: Validate base URL before fetching
  try {
    validateUrl(baseUrl, 'Bootstrap');
  } catch (error) {
    logSecurityViolation(baseUrl, 'fetchBootstrapConfig', error as Error);
    throw error;
  }
  
  const url = `${baseUrl}/totem.json`;
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Totem/1.0'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch config: ${response.status} ${response.statusText}`);
    }

    const config: BootstrapConfig = await response.json();
    
    // Validate required fields
    if (!config.rpc_endpoint || !config.project_id) {
      throw new Error('Invalid config: missing required fields');
    }

    // Fetch signing key dynamically (fingerprint-pinned, cached 24h)
    const signingKey = await fetchAndCachePublicKey(baseUrl);

    // Verify signature if present
    if (config.signature) {
      const isValid = await verifySignature(config, config.signature, signingKey);
      if (!isValid) {
        throw new Error('Invalid config signature - possible tampering detected');
      }
      console.log('✅ Config signature verified');
    } else {
      console.warn('⚠️ Config has no signature - verification skipped');
    }

    // Security: Validate bootstrap config with SecurityValidator
    try {
      await validateBootstrapConfig({
        rpc_endpoint: config.rpc_endpoint,
        signature: config.signature || ''
      });
    } catch (error) {
      logSecurityViolation(config.rpc_endpoint, 'validateBootstrapConfig', error as Error);
      throw error;
    }

    console.log('✅ Bootstrap config fetched:', {
      version: config.version,
      project_id: config.project_id,
      daily_quota: config.quotas.daily_requests
    });

    return config;
  } catch (error) {
    console.error('❌ Failed to fetch bootstrap config:', error);
    throw error;
  }
}

/**
 * Persist configuration to chrome.storage
 * Stores both under totem_config AND as top-level keys for backwards compatibility
 */
export async function persistConfig(config: BootstrapConfig): Promise<void> {
  // Extract base URL from rpc_endpoint (remove /v1/{projectId})
  const baseUrl = config.rpc_endpoint.replace(/\/v1\/.*$/, '');
  
  const storedConfig: StoredConfig = {
    AXIA_BASE: baseUrl,
    AXIA_PROJECT_ID: config.project_id,
    config: config,
    last_updated: Date.now()
  };

  // Write BOTH formats for backwards compatibility:
  // 1. New format under totem_config key
  // 2. Old format as top-level AXIA_BASE and AXIA_PROJECT_ID
  await chrome.storage.local.set({
    [CONFIG_STORAGE_KEY]: storedConfig,
    AXIA_BASE: baseUrl,
    AXIA_PROJECT_ID: config.project_id
  });
  
  console.log('💾 Config persisted to storage (both formats):', {
    base: baseUrl,
    project_id: config.project_id
  });
}

/**
 * Load configuration from chrome.storage
 */
export async function loadConfig(): Promise<StoredConfig | null> {
  const result = await chrome.storage.local.get(CONFIG_STORAGE_KEY);
  return result[CONFIG_STORAGE_KEY] || null;
}

/**
 * Get bootstrap configuration with priority override logic
 * Priority: 1) Designer Live mode → 2) Existing cache → 3) Fresh fetch
 */
export async function getBootstrapConfig(): Promise<StoredConfig | null> {
  // Priority 1: Check Designer mode overrides (env vars or Live mode)
  if (isDesignerMode()) {
    const effectiveConfig = await DesignerConfigManager.getEffectiveConfig();
    
    if (effectiveConfig.isLive) {
      console.log('🔧 [Designer Live Mode] Using override config:', {
        baseUrl: effectiveConfig.baseUrl,
        projectId: effectiveConfig.projectId
      });
      
      // Create synthetic stored config for Designer Live mode
      const syntheticConfig: StoredConfig = {
        AXIA_BASE: effectiveConfig.baseUrl,
        AXIA_PROJECT_ID: effectiveConfig.projectId,
        config: {
          version: '1.0.0-designer',
          rpc_endpoint: `${effectiveConfig.baseUrl}/v1/${effectiveConfig.projectId}`,
          project_id: effectiveConfig.projectId,
          quotas: { daily_requests: 10000 },
          rate_limits: { requests_per_minute: 60, burst_capacity: 100 },
          upgrade_messaging: {
            title: 'Upgrade Required',
            description: 'Designer mode testing',
            cta_text: 'Learn More',
            cta_url: 'https://app.axia.to'
          },
          bootstrap: { enabled: false }
        },
        last_updated: Date.now()
      };
      
      // Persist to storage so AxiaRpcClient can read it
      await chrome.storage.local.set({
        AXIA_BASE: effectiveConfig.baseUrl,
        AXIA_PROJECT_ID: effectiveConfig.projectId
      });
      
      return syntheticConfig;
    }
  }
  
  // Priority 2 & 3: Use existing cache or fetch fresh
  return await loadConfig();
}

/**
 * Initialize bootstrap on extension install/startup
 * Security: Revalidates cached configs on cold start
 * Uses singleflight pattern to prevent concurrent config fetch/validation
 */
export async function initializeBootstrap(): Promise<StoredConfig> {
  // Singleflight: Return existing promise if already in-flight
  if (bootstrapPromise) {
    console.log('[Bootstrap] Already initializing, returning existing promise');
    return bootstrapPromise;
  }
  
  // Start new initialization
  bootstrapPromise = initializeBootstrapImpl();
  
  try {
    const result = await bootstrapPromise;
    return result;
  } finally {
    // Clear promise after completion (success or failure)
    // This allows future refresh calls to work
    bootstrapPromise = null;
  }
}

/**
 * Internal bootstrap implementation
 */
async function initializeBootstrapImpl(): Promise<StoredConfig> {
  console.log('🚀 Initializing Totem bootstrap...');
  
  // Check Designer mode override first
  const overrideConfig = await getBootstrapConfig();
  if (overrideConfig) {
    console.log('✅ Using override config (Designer mode or cached)');
    
    // Security: Validate Designer mode URLs before using
    try {
      await validateBootstrapConfig({
        rpc_endpoint: overrideConfig.config.rpc_endpoint,
        signature: overrideConfig.config.signature || ''
      });
    } catch (error) {
      console.error('❌ Designer mode config failed validation:', error);
      logSecurityViolation(overrideConfig.config.rpc_endpoint, 'initializeBootstrap (Designer)', error as Error);
      throw new Error('Designer mode config failed security validation');
    }
    
    return overrideConfig;
  }
  
  // Check if config already exists
  const existing = await loadConfig();
  
  if (existing) {
    // Migration: rpc.axia.to → api.axia.to (rpc.axia.to has CF path-mangling)
    if (existing.AXIA_BASE?.includes('rpc.axia.to')) {
      console.warn('[Bootstrap] ⚠️ Detected stale rpc.axia.to base URL — migrating to api.axia.to...');
      try {
        const newConfig = await fetchBootstrapConfig();
        await persistConfig(newConfig);
        return await loadConfig() as StoredConfig;
      } catch (migErr) {
        console.error('[Bootstrap] Migration fetch failed, patching in-place:', migErr);
        const patched = {
          ...existing,
          AXIA_BASE: existing.AXIA_BASE.replace('https://rpc.axia.to', 'https://api.axia.to'),
          config: {
            ...existing.config,
            rpc_endpoint: existing.config.rpc_endpoint.replace('https://rpc.axia.to', 'https://api.axia.to'),
          },
        };
        await chrome.storage.local.set({
          totem_config: patched,
          AXIA_BASE: patched.AXIA_BASE,
        });
        return patched;
      }
    }

    console.log('📦 Cached config found, revalidating on cold start...');
    
    // Security: CRITICAL - Revalidate cached config on cold start
    // This prevents tampered chrome.storage values from persisting across restarts
    try {
      // Validate URL against allow-list
      await validateBootstrapConfig({
        rpc_endpoint: existing.config.rpc_endpoint,
        signature: existing.config.signature || ''
      });
      
      // Verify signature if present (fetch signing key with fingerprint check)
      if (existing.config.signature) {
        const signingKey = await fetchAndCachePublicKey(existing.AXIA_BASE || DEFAULT_RPC_BASE);
        const isValid = await verifySignature(existing.config, existing.config.signature, signingKey);
        if (!isValid) {
          throw new Error('Cached config signature verification failed - possible tampering');
        }
        console.log('✅ Cached config signature verified on cold start');
      }
      
      console.log('✅ Cached config validated, using:', existing.AXIA_PROJECT_ID);
      
    } catch (error) {
      console.error('❌ Cached config failed validation on cold start:', error);
      logSecurityViolation(existing.config.rpc_endpoint, 'initializeBootstrap (cold start)', error as Error);
      
      // Fail closed: Reject tampered cache and force fresh fetch
      console.warn('⚠️  Rejecting tampered cache, fetching fresh config...');
      const newConfig = await fetchBootstrapConfig();
      await persistConfig(newConfig);
      return await loadConfig() as StoredConfig;
    }
    
    // Check if auto-update is enabled and config is stale
    // Safe access for nested properties (may be undefined in dev/designer mode)
    const hoursSinceUpdate = (Date.now() - existing.last_updated) / (1000 * 60 * 60);
    const updateInterval = existing.config?.bootstrap?.auto_update_interval_hours || 24;
    const autoUpdateEnabled = existing.config?.bootstrap?.enabled || false;
    
    if (autoUpdateEnabled && hoursSinceUpdate > updateInterval) {
      console.log('🔄 Config is stale, updating...');
      try {
        const newConfig = await fetchBootstrapConfig();
        await persistConfig(newConfig);
        return await loadConfig() as StoredConfig;
      } catch (error) {
        console.warn('⚠️ Failed to update config, using cached version:', error);
        return existing;
      }
    }
    
    return existing;
  }
  
  // Fetch fresh config
  const config = await fetchBootstrapConfig();
  await persistConfig(config);
  
  const stored = await loadConfig();
  if (!stored) {
    throw new Error('Failed to load config after persisting');
  }
  
  return stored;
}

/**
 * Get RPC endpoint from stored config
 */
export async function getRpcEndpoint(): Promise<string> {
  const config = await loadConfig();
  
  if (!config) {
    console.warn('⚠️ No config found, using default endpoint');
    return `${DEFAULT_RPC_BASE}/v1/totem-shared`;
  }
  
  return `${config.AXIA_BASE}/v1/${config.AXIA_PROJECT_ID}`;
}

/**
 * Get project ID from stored config
 */
export async function getProjectId(): Promise<string> {
  const config = await loadConfig();
  return config?.AXIA_PROJECT_ID || 'totem-shared';
}

/**
 * Force refresh configuration
 */
export async function refreshConfig(): Promise<StoredConfig> {
  console.log('🔄 Force refreshing config...');
  const config = await fetchBootstrapConfig();
  await persistConfig(config);
  const stored = await loadConfig();
  if (!stored) {
    throw new Error('Failed to load config after refresh');
  }
  return stored;
}
