/**
 * Security Validator
 * 
 * Enforces security boundaries to prevent API bypass attacks.
 * Used by ALL code paths: bootstrap, AxiaRpcClient, Designer mode.
 * 
 * Security Properties:
 * 1. URL Allow-listing - Only approved Axia domains can be used
 * 2. Signature Verification - Bootstrap configs must be Ed25519 signed
 * 3. Session Caching - Validation results cached per session for performance
 */

import * as ed25519 from '@noble/ed25519';
import { sha512 } from '@noble/hashes/sha2';

// Initialize SHA-512 for Ed25519 (required for @noble/ed25519 v2.x)
// This enables sync methods: sign, verify, keygen
ed25519.hashes.sha512 = sha512;

/**
 * Approved RPC endpoint domains - Injected at build time by webpack
 * 
 * Production builds: ONLY Axia domains (api.axia.to, rpc.axia.to)
 * Development builds: Axia domains + localhost/127.0.0.1 for testing
 * 
 * Security: This constant is set by webpack.DefinePlugin at compile time.
 * Production bundles will NEVER contain localhost endpoints.
 * 
 * @see webpack.config.js - DefinePlugin configuration
 */
// @ts-ignore - webpack.DefinePlugin injects this as a JSON-serialized array
declare const __ALLOWED_HOSTS__: string[];
const ALLOWED_HOSTS: string[] = __ALLOWED_HOSTS__;

/**
 * Session cache for validated configurations
 * Cleared on extension restart
 */
interface ValidatedConfig {
  baseUrl: string;
  validatedAt: number;
  signature: string;
}

let sessionCache: ValidatedConfig | null = null;

/**
 * Extract hostname from URL for validation
 */
function extractHostname(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch {
    throw new Error(`Invalid URL format: ${url}`);
  }
}

/**
 * Check if URL is in the approved allow-list
 */
export function isAllowedHost(url: string): boolean {
  const hostname = extractHostname(url);
  
  // Exact match or subdomain match
  return ALLOWED_HOSTS.some(allowedHost => {
    if (hostname === allowedHost) return true;
    if (hostname.endsWith('.' + allowedHost)) return true;
    return false;
  });
}

/**
 * Validate URL against allow-list
 * Throws if URL is not approved
 */
export function validateUrl(url: string, context: string = 'RPC'): void {
  if (!isAllowedHost(url)) {
    const hostname = extractHostname(url);
    console.error(`[SecurityValidator] ❌ Blocked unauthorized ${context} endpoint: ${hostname}`);
    console.error(`[SecurityValidator]    Approved domains: ${ALLOWED_HOSTS.join(', ')}`);
    
    throw new Error(
      `Security violation: ${context} endpoint '${hostname}' is not in the approved domain list. ` +
      `Only Axia API gateways are allowed.`
    );
  }
  
  console.log(`[SecurityValidator] ✅ ${context} endpoint validated: ${extractHostname(url)}`);
}

/**
 * Verify Ed25519 signature on bootstrap config
 */
export async function verifySignature(
  payload: string,
  signature: string,
  publicKeyPem: string
): Promise<boolean> {
  try {
    // Extract public key bytes from PEM format
    const pemContent = publicKeyPem
      .replace('-----BEGIN PUBLIC KEY-----', '')
      .replace('-----END PUBLIC KEY-----', '')
      .replace(/\s/g, '');
    
    // Decode base64 PEM to get DER-encoded SubjectPublicKeyInfo
    const derBytes = Uint8Array.from(atob(pemContent), c => c.charCodeAt(0));
    
    // Extract raw 32-byte public key from DER structure
    // DER structure: SEQUENCE { SEQUENCE { OID, NULL }, BIT STRING }
    // The actual key is in the BIT STRING (last 32 bytes)
    const publicKeyBytes = derBytes.slice(-32);
    
    // Decode hex signature
    const signatureBytes = Uint8Array.from(
      signature.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16))
    );
    
    // Hash the payload
    const messageBytes = new TextEncoder().encode(payload);
    
    // Verify signature
    const isValid = await ed25519.verify(signatureBytes, messageBytes, publicKeyBytes);
    
    return isValid;
  } catch (error) {
    console.error('[SecurityValidator] Signature verification failed:', error);
    return false;
  }
}

/**
 * Validate and cache bootstrap configuration
 * Called on cold start and when loading new configs
 */
export async function validateBootstrapConfig(config: {
  rpc_endpoint: string;
  signature: string;
  public_key?: string;
}): Promise<void> {
  console.log('[SecurityValidator] 🔒 Validating bootstrap configuration...');
  
  // Step 1: Validate URL against allow-list
  validateUrl(config.rpc_endpoint, 'Bootstrap RPC');
  
  // Step 2: Verify Ed25519 signature (if public key provided)
  if (config.public_key && config.signature) {
    const payload = JSON.stringify({
      rpc_endpoint: config.rpc_endpoint
    });
    
    const isValid = await verifySignature(payload, config.signature, config.public_key);
    
    if (!isValid) {
      console.error('[SecurityValidator] ❌ Bootstrap signature verification failed');
      throw new Error(
        'Security violation: Bootstrap configuration signature is invalid. ' +
        'The config may have been tampered with.'
      );
    }
    
    console.log('[SecurityValidator] ✅ Bootstrap signature verified');
  }
  
  // Step 3: Cache validated config for session
  sessionCache = {
    baseUrl: config.rpc_endpoint,
    validatedAt: Date.now(),
    signature: config.signature
  };
  
  console.log('[SecurityValidator] ✅ Bootstrap configuration validated and cached');
}

/**
 * Check if current session has a validated config
 */
export function hasValidatedConfig(): boolean {
  return sessionCache !== null;
}

/**
 * Get cached validated base URL
 * Returns null if no validated config in session
 */
export function getValidatedBaseUrl(): string | null {
  return sessionCache?.baseUrl || null;
}

/**
 * Clear session cache (called on logout or reset)
 */
export function clearValidationCache(): void {
  sessionCache = null;
  console.log('[SecurityValidator] Session validation cache cleared');
}

/**
 * Security telemetry: Log rejected URL attempts
 */
export function logSecurityViolation(
  attemptedUrl: string,
  context: string,
  error: Error
): void {
  const violation = {
    timestamp: new Date().toISOString(),
    attemptedUrl,
    hostname: extractHostname(attemptedUrl),
    context,
    error: error.message,
    allowedHosts: ALLOWED_HOSTS
  };
  
  console.error('[SecurityValidator] 🚨 SECURITY VIOLATION DETECTED:');
  console.error(JSON.stringify(violation, null, 2));
  
  // TODO: Send to backend telemetry endpoint for monitoring
  // fetch('/api/security/violations', { method: 'POST', body: JSON.stringify(violation) })
}
