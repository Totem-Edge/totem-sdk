/**
 * Enhanced Totem RPC Provider with Idempotency and Smart Backoff
 * Implements AWS-style decorrelated jitter backoff and proper retry logic
 */

import { sha3_256 } from '@noble/hashes/sha3';
import { quotaManager } from '../core/quota/manager';
import { getRpcEndpoint as getBootstrapEndpoint } from '../core/config/bootstrap';

// Write method classification for Minima blockchain
const WRITE_METHODS = new Set([
  'tx/build',
  'tx/submit', 
  'wots/lease',
  'balance/send',
  'wallet/import',
  'wallet/backup',
  'send',
  'multisig',
  'vault',
  'coins'
]);

function isWriteMethod(method: string): boolean {
  return WRITE_METHODS.has(method);
}

/**
 * Decorrelated jitter backoff (AWS-style)
 * Provides better retry distribution than exponential backoff
 */
function nextSleepMs(attempt: number, base = 400, cap = 10_000): number {
  const max = Math.min(cap, base * Math.pow(2, attempt));
  const rand = crypto.getRandomValues(new Uint32Array(1))[0] / 0xFFFFFFFF;
  return Math.floor(rand * (max - base + 1)) + base;
}

export interface RpcCallOptions {
  maxAttempts?: number;
  baseRetryMs?: number;
  maxRetryMs?: number;
  timeout?: number;
}

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number;
  retryAfter?: number;
}

export interface RpcResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

/**
 * Detect if running on Chrome/Chromium (supports PQ-TLS)
 */
function isChromeBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent.toLowerCase();
  return ua.includes('chrome') && !ua.includes('edg');
}

/**
 * Get RPC endpoint based on browser and user preference
 * Uses bootstrap config if available, otherwise requests from background worker
 */
async function getRpcEndpoint(projectId: string): Promise<string> {
  // Try bootstrap config first
  try {
    const endpoint = await getBootstrapEndpoint();
    if (endpoint) {
      return endpoint;
    }
  } catch (e) {
    console.warn('Failed to get endpoint from bootstrap config:', e);
  }

  // Request endpoint selection from background/service worker (has reliable chrome.storage access)
  if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
    try {
      const response = await chrome.runtime.sendMessage({ 
        type: 'GET_RPC_ENDPOINT',
        projectId 
      });
      if (response?.endpoint) {
        return response.endpoint;
      }
    } catch (e) {
      console.warn('Failed to get endpoint from background, falling back to default:', e);
    }
  }
  
  // Fallback: Use standard endpoint if background unavailable
  return `https://api.axia.to/v1/${projectId}`;
}

/**
 * Enhanced RPC call with idempotency and smart retry logic
 */
export async function rpcCall(
  projectId: string,
  method: string,
  params: any[] = [],
  opts: RpcCallOptions = {}
): Promise<RpcResponse> {
  const {
    maxAttempts = 5,
    baseRetryMs = 400,
    maxRetryMs = 10_000,
    timeout = 30_000
  } = opts;

  const url = await getRpcEndpoint(projectId);

  // Generate idempotency key for write operations
  let idempotencyKey: string | undefined;
  if (isWriteMethod(method)) {
    // Use first param if it's a raw transaction, otherwise hash the entire request
    const rawData = typeof params?.[0] === 'string' ? params[0] : JSON.stringify({ method, params });
    const digest = sha3_256(new TextEncoder().encode(rawData));
    idempotencyKey = '0x' + Array.from(digest, b => b.toString(16).padStart(2, '0')).join('');
  }

  let attempt = 0;
  let lastRateLimitInfo: RateLimitInfo | null = null;

  for (;;) {
    const requestId = `${Date.now()}-${Array.from(crypto.getRandomValues(new Uint8Array(6)), b => b.toString(36)).join('').slice(0, 9)}`;
    const body = { 
      jsonrpc: '2.0' as const, 
      method, 
      params, 
      id: requestId 
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'Totem/1.0'
    };

    if (idempotencyKey) {
      headers['X-Idempotency-Key'] = idempotencyKey;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      // Extract rate limiting headers
      const limit = response.headers.get('X-RateLimit-Limit');
      const remaining = response.headers.get('X-RateLimit-Remaining');
      const reset = response.headers.get('X-RateLimit-Reset');
      const retryAfterHeader = response.headers.get('Retry-After');

      if (limit && remaining && reset) {
        lastRateLimitInfo = {
          limit: parseInt(limit),
          remaining: parseInt(remaining),
          reset: parseInt(reset),
          retryAfter: retryAfterHeader ? parseInt(retryAfterHeader) : undefined
        };

        // Emit rate limit info for UI updates
        console.log('🎯 Rate limit info:', lastRateLimitInfo);
      }

      // Extract and update quota headers (daily/monthly limits)
      await quotaManager.updateFromHeaders(response.headers);

      if (response.status === 200) {
        const json: RpcResponse = await response.json();
        
        // Success - reset retry state and return
        if (!json.error) {
          console.log(`✅ RPC ${method} successful after ${attempt + 1} attempt(s)`);
          return json;
        }

        // Handle RPC-level errors that should be retried (gateway issues)
        if (json.error?.code === 429 && json.error?.data?.retryAfter) {
          const retryAfterMs = Number(json.error.data.retryAfter) * 1000;
          console.log(`⏸️ Gateway rate limit, sleeping ${retryAfterMs}ms`);
          await sleep(retryAfterMs);
          continue;
        }

        // Other RPC errors should not be retried
        console.log(`❌ RPC error: ${json.error?.message}`);
        return json;
      }

      // Handle HTTP 429 Rate Limiting / Quota Exceeded
      if (response.status === 429) {
        // Extract quota headers even on 429 to update UI
        await quotaManager.updateFromHeaders(response.headers);
        
        attempt++;
        if (attempt >= maxAttempts) {
          const json = await response.json();
          throw new Error(json.error?.message || `Rate limited after ${attempt} attempts`);
        }

        const retryAfterMs = retryAfterHeader 
          ? parseInt(retryAfterHeader) * 1000 
          : nextSleepMs(attempt, baseRetryMs, maxRetryMs);

        console.log(`⏸️ HTTP 429, sleeping ${retryAfterMs}ms (attempt ${attempt}/${maxAttempts})`);
        await sleep(retryAfterMs);
        continue;
      }

      // Handle transient 5xx errors
      if (response.status >= 500 && response.status < 600) {
        attempt++;
        if (attempt >= maxAttempts) {
          throw new Error(`Gateway error ${response.status} after ${attempt} attempts`);
        }

        const retryMs = nextSleepMs(attempt, baseRetryMs, maxRetryMs);
        console.log(`⏸️ HTTP ${response.status}, sleeping ${retryMs}ms (attempt ${attempt}/${maxAttempts})`);
        await sleep(retryMs);
        continue;
      }

      // Non-retryable 4xx errors
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        attempt++;
        if (attempt >= maxAttempts) {
          throw new Error(`Request timeout after ${attempt} attempts`);
        }

        const retryMs = nextSleepMs(attempt, baseRetryMs, maxRetryMs);
        console.log(`⏰ Timeout, sleeping ${retryMs}ms (attempt ${attempt}/${maxAttempts})`);
        await sleep(retryMs);
        continue;
      }

      throw error;
    }
  }
}

/**
 * Get current rate limit information for display in UI
 */
export function getRateLimitInfo(): RateLimitInfo | null {
  // This would be updated by the rpcCall function
  // Implementation depends on how you want to store/share this state
  return null;
}

/**
 * Validate idempotency key format
 */
export function isValidIdempotencyKey(key: string): boolean {
  const cleanKey = key.startsWith('0x') ? key.substring(2) : key;
  return /^[a-fA-F0-9]{64}$/.test(cleanKey);
}

/**
 * Sleep utility function
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Legacy compatibility wrapper
 */
export async function request(params: {
  method: string;
  params?: any[];
  projectId?: string;
}): Promise<any> {
  const { method, params: rpcParams = [], projectId = 'totem-shared' } = params;
  
  const response = await rpcCall(projectId, method, rpcParams);
  
  if (response.error) {
    const error = new Error(response.error.message);
    (error as any).code = response.error.code;
    (error as any).data = response.error.data;
    throw error;
  }
  
  return response.result;
}