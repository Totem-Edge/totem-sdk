/**
 * Axia RPC Client
 * 
 * Typed JSON-RPC client for totem-shared pool integration
 * Reads bootstrap config from chrome.storage and makes authenticated RPC calls
 * 
 * Security: All RPC endpoints validated against allow-list to prevent API bypass
 */

import { quotaTracker } from './QuotaTracker';
import { validateUrl, logSecurityViolation } from '../security/SecurityValidator';

// Custom Error Classes
export class AxiaError extends Error {
  constructor(
    message: string,
    public code: number,
    public data?: any
  ) {
    super(message);
    this.name = 'AxiaError';
  }
}

export class QuotaExceededError extends AxiaError {
  constructor(
    message: string,
    public retryAfter?: number,
    public quotaType?: string
  ) {
    super(message, 429);
    this.name = 'QuotaExceededError';
  }
}

export class NetworkError extends Error {
  constructor(message: string, public isRetryable: boolean = false) {
    super(message);
    this.name = 'NetworkError';
  }
}

// Axia Error Code Mappings (from System Projects documentation)
export enum AxiaErrorCode {
  INVALID_REQUEST = 40001,
  INVALID_PROJECT_ID = 40101,
  SECRET_REQUIRED = 40102,
  PROJECT_DISABLED = 40301,
  METHOD_NOT_ALLOWED = 40302,
  RATE_LIMIT_EXCEEDED = 42901,
  UPSTREAM_ERROR = 50201,
  UPSTREAM_TIMEOUT = 50401
}

// JSON-RPC 2.0 Types
export interface JsonRpcRequest {
  jsonrpc: '2.0';
  method: string;
  params?: any[] | object;
  id: string | number;
}

export interface JsonRpcResponse<T = any> {
  jsonrpc: '2.0';
  id: string | number;
  result?: T;
  error?: JsonRpcError;
}

export interface JsonRpcError {
  code: number;
  message: string;
  data?: {
    axia?: {
      code: number;
      retryAfter?: number;
      quotaType?: string;
    };
    [key: string]: any;
  };
}

// Axia-specific types
export interface AxiaBootstrapConfig {
  AXIA_BASE: string;
  AXIA_PROJECT_ID: string;
  AXIA_QUOTAS?: {
    daily_requests: number;
    monthly_requests: number;
  };
  AXIA_RATE_LIMITS?: {
    rpm: number;
    burst: number;
  };
}

export interface QuotaHeaders {
  dailyLimit?: number;
  dailyRemaining?: number;
  monthlyLimit?: number;
  monthlyRemaining?: number;
  quotaReset?: number;
  retryAfter?: number;
}

/**
 * Main Axia RPC Client Class
 */
export class AxiaRpcClient {
  private requestIdCounter: number = 1;
  private config: AxiaBootstrapConfig | null = null;
  private configLoaded: Promise<void>;
  private configListenerAttached: boolean = false;
  private _userIdentityHash: string | null = null;
  
  // Retry configuration
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_BASE_DELAY = 1000; // 1 second

  constructor() {
    // Load config on initialization
    this.configLoaded = this.loadBootstrapConfig();
    
    // Attach storage listener for automatic config reloading
    this.attachConfigListener();
  }
  
  setUserIdentityHash(hash: string): void {
    this._userIdentityHash = hash;
    console.log('[AxiaRpcClient] User identity hash set');
  }

  clearUserIdentityHash(): void {
    this._userIdentityHash = null;
  }

  getUserIdentityHash(): string | null {
    return this._userIdentityHash;
  }

  /**
   * Attach listener for config changes in chrome.storage
   * Automatically reloads config when AXIA_* keys change
   */
  private attachConfigListener(): void {
    if (this.configListenerAttached) return;
    
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== 'local') return;
      
      const relevantKeys = ['AXIA_BASE', 'AXIA_PROJECT_ID', 'AXIA_QUOTAS', 'AXIA_RATE_LIMITS'];
      const hasRelevantChange = relevantKeys.some(key => key in changes);
      
      if (hasRelevantChange) {
        console.log('[AxiaRpcClient] Config change detected, reloading...');
        this.reloadConfig().catch(err => {
          console.error('[AxiaRpcClient] Auto-reload failed:', err);
        });
      }
    });
    
    this.configListenerAttached = true;
  }
  
  /**
   * Reload configuration from storage
   * Use this to force a config refresh (e.g., after mode switch in Designer)
   */
  public async reloadConfig(): Promise<void> {
    console.log('[AxiaRpcClient] Reloading configuration...');
    this.config = null;
    this.configLoaded = this.loadBootstrapConfig();
    await this.configLoaded;
    console.log('[AxiaRpcClient] ✅ Configuration reloaded successfully');
  }
  
  /**
   * Get current configuration (for debugging)
   */
  public async getConfig(): Promise<AxiaBootstrapConfig | null> {
    await this.configLoaded;
    return this.config;
  }

  /**
   * Load bootstrap configuration from chrome.storage
   * Self-healing: fetches fresh config if cache is empty
   */
  private async loadBootstrapConfig(): Promise<void> {
    try {
      let stored = await chrome.storage.local.get([
        'AXIA_BASE',
        'AXIA_PROJECT_ID',
        'AXIA_QUOTAS',
        'AXIA_RATE_LIMITS'
      ]);

      // Self-healing: if config not cached, fetch it ourselves
      if (!stored.AXIA_BASE || !stored.AXIA_PROJECT_ID) {
        console.warn('[AxiaRpcClient] Bootstrap config not cached, fetching fresh...');
        
        try {
          // Dynamically import to avoid circular dependency
          const { initializeBootstrap } = await import('../config/bootstrap');
          await initializeBootstrap();
          
          // Re-read from storage after fetching
          stored = await chrome.storage.local.get([
            'AXIA_BASE',
            'AXIA_PROJECT_ID',
            'AXIA_QUOTAS',
            'AXIA_RATE_LIMITS'
          ]);
          
          if (!stored.AXIA_BASE || !stored.AXIA_PROJECT_ID) {
            throw new Error('Bootstrap config fetch failed - still not in storage');
          }
          
          console.log('[AxiaRpcClient] ✅ Self-healing successful, config fetched');
        } catch (fetchError) {
          console.error('[AxiaRpcClient] ❌ Self-healing failed:', fetchError);
          throw new Error('Bootstrap config not found and fetch failed. Check network connectivity.');
        }
      }

      this.config = {
        AXIA_BASE: stored.AXIA_BASE,
        AXIA_PROJECT_ID: stored.AXIA_PROJECT_ID,
        AXIA_QUOTAS: stored.AXIA_QUOTAS,
        AXIA_RATE_LIMITS: stored.AXIA_RATE_LIMITS
      };

      console.log('[AxiaRpcClient] Bootstrap config loaded:', {
        base: this.config.AXIA_BASE,
        projectId: this.config.AXIA_PROJECT_ID
      });
    } catch (error) {
      console.error('[AxiaRpcClient] Failed to load bootstrap config:', error);
      throw error;
    }
  }

  /**
   * Ensure config is loaded and validate base URL before making requests
   * Security: Validates all RPC endpoints against allow-list
   */
  private async ensureConfig(): Promise<AxiaBootstrapConfig> {
    await this.configLoaded;
    if (!this.config) {
      throw new Error('Axia RPC Client not initialized - config is null');
    }
    
    // Security: Validate base URL against allow-list
    try {
      validateUrl(this.config.AXIA_BASE, 'RPC');
    } catch (error) {
      // Log security violation and re-throw
      logSecurityViolation(this.config.AXIA_BASE, 'AxiaRpcClient', error as Error);
      throw error;
    }
    
    return this.config;
  }

  /**
   * Get next request ID (auto-incrementing)
   */
  private getNextRequestId(): number {
    return this.requestIdCounter++;
  }

  /**
   * Parse quota headers from response
   */
  private parseQuotaHeaders(headers: Headers): QuotaHeaders {
    const quotaHeaders: QuotaHeaders = {};

    const dailyLimit = headers.get('X-Quota-Limit-Daily');
    const dailyRemaining = headers.get('X-Quota-Remaining-Daily');
    const monthlyLimit = headers.get('X-Quota-Limit-Monthly');
    const monthlyRemaining = headers.get('X-Quota-Remaining-Monthly');
    const quotaReset = headers.get('X-Quota-Reset');
    const retryAfter = headers.get('Retry-After');

    if (dailyLimit) quotaHeaders.dailyLimit = parseInt(dailyLimit, 10);
    if (dailyRemaining) quotaHeaders.dailyRemaining = parseInt(dailyRemaining, 10);
    if (monthlyLimit) quotaHeaders.monthlyLimit = parseInt(monthlyLimit, 10);
    if (monthlyRemaining) quotaHeaders.monthlyRemaining = parseInt(monthlyRemaining, 10);
    if (quotaReset) quotaHeaders.quotaReset = parseInt(quotaReset, 10);
    if (retryAfter) quotaHeaders.retryAfter = parseInt(retryAfter, 10);

    return quotaHeaders;
  }

  /**
   * Sleep for exponential backoff
   */
  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Check if HTTP status code is retryable (5xx errors)
   */
  private isRetryableStatusCode(status: number): boolean {
    return status >= 500 && status < 600;
  }

  /**
   * Map JSON-RPC error to typed exception
   */
  private mapError(error: JsonRpcError, quotaHeaders: QuotaHeaders): Error {
    const axiaCode = error.data?.axia?.code;

    // Quota exceeded (429 or code 42901)
    if (axiaCode === AxiaErrorCode.RATE_LIMIT_EXCEEDED || error.code === 429) {
      return new QuotaExceededError(
        error.message || 'Quota exceeded',
        quotaHeaders.retryAfter || error.data?.axia?.retryAfter,
        error.data?.axia?.quotaType || 'daily'
      );
    }

    // Project-level errors (non-retryable)
    if (axiaCode === AxiaErrorCode.INVALID_PROJECT_ID) {
      return new AxiaError('Invalid project ID - check bootstrap config', axiaCode, error.data);
    }
    if (axiaCode === AxiaErrorCode.PROJECT_DISABLED) {
      return new AxiaError('Project disabled by administrator', axiaCode, error.data);
    }
    if (axiaCode === AxiaErrorCode.SECRET_REQUIRED) {
      return new AxiaError('Project requires secret authentication', axiaCode, error.data);
    }
    if (axiaCode === AxiaErrorCode.METHOD_NOT_ALLOWED) {
      return new AxiaError(`Method not allowed: ${error.message}`, axiaCode, error.data);
    }

    // Upstream errors (retryable in most cases)
    if (axiaCode === AxiaErrorCode.UPSTREAM_ERROR) {
      return new AxiaError('Upstream Minima node error', axiaCode, error.data);
    }
    if (axiaCode === AxiaErrorCode.UPSTREAM_TIMEOUT) {
      return new AxiaError('Upstream Minima node timeout', axiaCode, error.data);
    }

    // Other Axia errors
    if (axiaCode) {
      return new AxiaError(error.message, axiaCode, error.data);
    }

    // Generic RPC error (no Axia code)
    return new AxiaError(error.message || 'Unknown RPC error', error.code, error.data);
  }

  /**
   * Make JSON-RPC call to Axia API Gateway with retry logic
   * 
   * Throws typed exceptions for all errors - never returns error objects
   * 
   * @param method - RPC method name
   * @param params - Method parameters (array or object)
   * @returns Promise resolving to RPC response (or throws)
   * @throws {QuotaExceededError} - Quota exceeded (429)
   * @throws {AxiaError} - Axia-specific errors (40xxx, 50xxx)
   * @throws {NetworkError} - Network/transport failures
   */
  async call<T = any>(method: string, params?: any[] | object): Promise<{
    result: T;
    quotaHeaders: QuotaHeaders;
  }> {
    const config = await this.ensureConfig();
    const requestId = this.getNextRequestId();

    const rpcRequest: JsonRpcRequest = {
      jsonrpc: '2.0',
      method,
      params,
      id: requestId
    };

    const endpoint = `${config.AXIA_BASE}/v1/${config.AXIA_PROJECT_ID}`;

    console.log(`[AxiaRpcClient] RPC call #${requestId}: ${method}`, params);

    let lastError: Error | null = null;
    const requestBody = JSON.stringify(rpcRequest);

    // Retry loop with exponential backoff
    for (let attempt = 0; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'x-api-key': config.AXIA_PROJECT_ID
        };
        if (this._userIdentityHash) {
          headers['x-user-identity-hash'] = this._userIdentityHash;
        }

        const response = await fetch(endpoint, {
          method: 'POST',
          headers,
          body: requestBody
        });

        // Parse quota headers from response
        const quotaHeaders = this.parseQuotaHeaders(response.headers);

        // Track quota headers asynchronously (fire-and-forget to avoid blocking)
        quotaTracker.trackQuota(quotaHeaders).catch(err => {
          console.error('[AxiaRpcClient] Failed to track quota:', err);
        });

        // Check for retryable HTTP status codes (5xx)
        if (this.isRetryableStatusCode(response.status)) {
          const retryDelay = this.RETRY_BASE_DELAY * Math.pow(2, attempt);
          console.warn(`[AxiaRpcClient] HTTP ${response.status} on attempt ${attempt + 1}/${this.MAX_RETRIES + 1}. Retrying in ${retryDelay}ms...`);
          
          if (attempt < this.MAX_RETRIES) {
            await this.sleep(retryDelay);
            continue; // Retry
          } else {
            throw new NetworkError(`HTTP ${response.status} after ${this.MAX_RETRIES + 1} attempts`, false);
          }
        }

        // Handle non-JSON responses (502, 503 HTML errors, etc.)
        let rpcResponse: JsonRpcResponse<T>;
        try {
          rpcResponse = await response.json();
        } catch (parseError) {
          console.error(`[AxiaRpcClient] Failed to parse JSON response (HTTP ${response.status}):`, parseError);
          throw new NetworkError(`Invalid JSON response (HTTP ${response.status})`, this.isRetryableStatusCode(response.status));
        }

        if (rpcResponse.error) {
          console.error(`[AxiaRpcClient] RPC error #${requestId}:`, rpcResponse.error);
          
          // Map error to typed exception and ALWAYS throw (never return errors)
          const mappedError = this.mapError(rpcResponse.error, quotaHeaders);
          throw mappedError;
        }

        console.log(`[AxiaRpcClient] RPC success #${requestId}`, rpcResponse.result);

        return {
          result: rpcResponse.result,
          quotaHeaders
        };
      } catch (error: any) {
        lastError = error;

        // Don't retry QuotaExceededError or non-retryable network errors
        if (error instanceof QuotaExceededError || (error instanceof NetworkError && !error.isRetryable)) {
          throw error;
        }

        // Retry on network failures
        if (attempt < this.MAX_RETRIES) {
          const retryDelay = this.RETRY_BASE_DELAY * Math.pow(2, attempt);
          console.warn(`[AxiaRpcClient] Network error on attempt ${attempt + 1}/${this.MAX_RETRIES + 1}: ${error.message}. Retrying in ${retryDelay}ms...`);
          await this.sleep(retryDelay);
        } else {
          console.error(`[AxiaRpcClient] Network error after ${this.MAX_RETRIES + 1} attempts:`, error);
        }
      }
    }

    // All retries exhausted
    throw lastError || new NetworkError('Request failed after all retries', false);
  }

  /**
   * Get watermark (next available WOTS indices) from Axia API
   * Used for multi-device sync and crash recovery
   * 
   * @param rootPublicKey - Wallet root public key (Mx address)
   * @returns Promise with next available WOTS indices
   * @throws {AxiaError} - API errors (403, 404, 500)
   * @throws {NetworkError} - Network/transport failures
   */
  async getWatermark(rootPublicKey: string): Promise<{
    l1: number;
    l2: number;
    l3: number;
  }> {
    const config = await this.ensureConfig();
    // Pass root as a query param — the server reads req.query.root, not a header.
    const endpoint = `${config.AXIA_BASE}/v1/wots-hardened/watermark?root=${encodeURIComponent(rootPublicKey)}`;

    console.log('[AxiaRpcClient] Fetching watermark for:', rootPublicKey?.slice(0, 20) + '...');

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        const response = await fetch(endpoint, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': config.AXIA_PROJECT_ID
          }
        });

        const quotaHeaders = this.parseQuotaHeaders(response.headers);
        quotaTracker.trackQuota(quotaHeaders).catch(err => {
          console.error('[AxiaRpcClient] Failed to track quota:', err);
        });

        if (this.isRetryableStatusCode(response.status)) {
          const retryDelay = this.RETRY_BASE_DELAY * Math.pow(2, attempt);
          console.warn(`[AxiaRpcClient] HTTP ${response.status} on watermark fetch attempt ${attempt + 1}/${this.MAX_RETRIES + 1}. Retrying in ${retryDelay}ms...`);
          
          if (attempt < this.MAX_RETRIES) {
            await this.sleep(retryDelay);
            continue;
          } else {
            throw new NetworkError(`HTTP ${response.status} after ${this.MAX_RETRIES + 1} attempts`, false);
          }
        }

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[AxiaRpcClient] Watermark fetch failed (HTTP ${response.status}):`, errorText);
          
          if (response.status === 403) {
            throw new AxiaError('Unauthorized - project may not have access to WOTS watermark endpoint', 403);
          }
          if (response.status === 404) {
            throw new AxiaError('Watermark not found for this root public key', 404);
          }
          
          throw new AxiaError(`Watermark fetch failed: ${errorText}`, response.status);
        }

        const watermark = await response.json();
        
        if (typeof watermark.l1 !== 'number' || 
            typeof watermark.l2 !== 'number' || 
            typeof watermark.l3 !== 'number') {
          throw new AxiaError('Invalid watermark response - missing indices', 500);
        }

        console.log('[AxiaRpcClient] Watermark fetched:', watermark);
        return watermark;

      } catch (error: any) {
        lastError = error;

        if (error instanceof AxiaError || error instanceof QuotaExceededError) {
          throw error;
        }

        if (attempt < this.MAX_RETRIES) {
          const retryDelay = this.RETRY_BASE_DELAY * Math.pow(2, attempt);
          console.warn(`[AxiaRpcClient] Network error on watermark fetch attempt ${attempt + 1}/${this.MAX_RETRIES + 1}: ${error.message}. Retrying in ${retryDelay}ms...`);
          await this.sleep(retryDelay);
        } else {
          console.error(`[AxiaRpcClient] Watermark fetch failed after ${this.MAX_RETRIES + 1} attempts:`, error);
        }
      }
    }

    throw lastError || new NetworkError('Watermark fetch failed after all retries', false);
  }
}

// Singleton instance
export const axiaRpcClient = new AxiaRpcClient();
