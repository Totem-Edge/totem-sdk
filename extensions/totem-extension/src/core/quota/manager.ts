/**
 * Totem Quota Manager
 * Tracks quota usage from RPC response headers and provides UI state
 */

export interface QuotaInfo {
  daily: {
    limit: number;
    remaining: number;
    used: number;
    percentUsed: number;
  };
  monthly?: {
    limit: number;
    remaining: number;
    used: number;
    percentUsed: number;
  };
  resetTimestamp?: number;
  retryAfter?: number;
  isExceeded: boolean;
  exceededType?: 'daily' | 'monthly';
}

export interface QuotaHeaders {
  'X-Quota-Limit-Daily'?: string;
  'X-Quota-Remaining-Daily'?: string;
  'X-Quota-Limit-Monthly'?: string;
  'X-Quota-Remaining-Monthly'?: string;
  'X-Quota-Reset'?: string;
  'Retry-After'?: string;
}

type QuotaListener = (info: QuotaInfo) => void;

class QuotaManager {
  private currentQuota: QuotaInfo | null = null;
  private listeners: Set<QuotaListener> = new Set();
  private storageKey = 'totem_quota';

  constructor() {
    this.loadFromStorage();
  }

  /**
   * Parse quota headers from RPC response
   */
  parseHeaders(headers: Headers | Record<string, string>): QuotaInfo | null {
    const getHeader = (key: string): string | null => {
      if (headers instanceof Headers) {
        return headers.get(key);
      }
      return headers[key] || null;
    };

    const dailyLimit = getHeader('X-Quota-Limit-Daily');
    const dailyRemaining = getHeader('X-Quota-Remaining-Daily');
    const monthlyLimit = getHeader('X-Quota-Limit-Monthly');
    const monthlyRemaining = getHeader('X-Quota-Remaining-Monthly');
    const reset = getHeader('X-Quota-Reset');
    const retryAfter = getHeader('Retry-After');

    // No quota headers present
    if (!dailyLimit && !monthlyLimit) {
      return null;
    }

    const daily = dailyLimit ? {
      limit: parseInt(dailyLimit),
      remaining: parseInt(dailyRemaining || '0'),
      used: 0,
      percentUsed: 0
    } : null;

    if (daily) {
      daily.used = daily.limit - daily.remaining;
      daily.percentUsed = (daily.used / daily.limit) * 100;
    }

    const monthly = monthlyLimit ? {
      limit: parseInt(monthlyLimit),
      remaining: parseInt(monthlyRemaining || '0'),
      used: 0,
      percentUsed: 0
    } : undefined;

    if (monthly) {
      monthly.used = monthly.limit - monthly.remaining;
      monthly.percentUsed = (monthly.used / monthly.limit) * 100;
    }

    const isExceeded = (daily?.remaining === 0) || (monthly?.remaining === 0);
    const exceededType = daily?.remaining === 0 ? 'daily' : monthly?.remaining === 0 ? 'monthly' : undefined;

    const quotaInfo: QuotaInfo = {
      daily: daily!,
      monthly,
      resetTimestamp: reset ? parseInt(reset) : undefined,
      retryAfter: retryAfter ? parseInt(retryAfter) : undefined,
      isExceeded,
      exceededType
    };

    return quotaInfo;
  }

  /**
   * Update quota from response headers
   */
  async updateFromHeaders(headers: Headers | Record<string, string>): Promise<void> {
    const quotaInfo = this.parseHeaders(headers);
    
    if (!quotaInfo) {
      return;
    }

    this.currentQuota = quotaInfo;
    await this.saveToStorage();
    this.notifyListeners();

    console.log('📊 Quota updated:', {
      daily: `${quotaInfo.daily.remaining}/${quotaInfo.daily.limit}`,
      percentUsed: `${quotaInfo.daily.percentUsed.toFixed(1)}%`,
      exceeded: quotaInfo.isExceeded
    });
  }

  /**
   * Get current quota info
   */
  getQuota(): QuotaInfo | null {
    return this.currentQuota;
  }

  /**
   * Check if quota warning threshold reached (80%)
   */
  isWarningThreshold(): boolean {
    if (!this.currentQuota) return false;
    return this.currentQuota.daily.percentUsed >= 80 && !this.currentQuota.isExceeded;
  }

  /**
   * Get formatted time until reset
   */
  getTimeUntilReset(): string {
    if (!this.currentQuota?.resetTimestamp) {
      return 'Unknown';
    }

    const now = Date.now() / 1000;
    const secondsUntil = this.currentQuota.resetTimestamp - now;

    if (secondsUntil < 0) {
      return 'Now';
    }

    const hours = Math.floor(secondsUntil / 3600);
    const minutes = Math.floor((secondsUntil % 3600) / 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  }

  /**
   * Subscribe to quota updates
   */
  subscribe(listener: QuotaListener): () => void {
    this.listeners.add(listener);
    
    // Immediately notify with current state
    if (this.currentQuota) {
      listener(this.currentQuota);
    }

    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Notify all listeners
   */
  private notifyListeners(): void {
    if (!this.currentQuota) return;
    
    this.listeners.forEach(listener => {
      try {
        listener(this.currentQuota!);
      } catch (error) {
        console.error('Error in quota listener:', error);
      }
    });
  }

  /**
   * Save quota to storage for persistence
   */
  private async saveToStorage(): Promise<void> {
    if (!this.currentQuota) return;
    
    try {
      await chrome.storage.local.set({
        [this.storageKey]: {
          quota: this.currentQuota,
          timestamp: Date.now()
        }
      });
    } catch (error) {
      console.error('Failed to save quota to storage:', error);
    }
  }

  /**
   * Load quota from storage
   */
  private async loadFromStorage(): Promise<void> {
    try {
      const result = await chrome.storage.local.get(this.storageKey);
      const stored = result[this.storageKey];
      
      if (stored?.quota) {
        // Only use stored quota if less than 5 minutes old
        const age = Date.now() - stored.timestamp;
        if (age < 5 * 60 * 1000) {
          this.currentQuota = stored.quota;
          console.log('📦 Loaded quota from storage:', this.currentQuota);
        }
      }
    } catch (error) {
      console.error('Failed to load quota from storage:', error);
    }
  }

  /**
   * Clear quota state (for testing)
   */
  async clear(): Promise<void> {
    this.currentQuota = null;
    await chrome.storage.local.remove(this.storageKey);
    this.notifyListeners();
  }
}

// Export singleton instance
export const quotaManager = new QuotaManager();
