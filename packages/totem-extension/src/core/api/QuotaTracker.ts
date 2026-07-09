/**
 * Quota Tracker Service
 * 
 * Intercepts Axia RPC responses, parses quota headers, persists state,
 * and emits events for UI consumption
 */

import { QuotaHeaders } from './AxiaRpcClient';

export interface QuotaState {
  dailyLimit: number;
  dailyRemaining: number;
  dailyUsed: number;
  monthlyLimit?: number;
  monthlyRemaining?: number;
  monthlyUsed?: number;
  quotaReset?: number;
  lastUpdated: number;
  requestCount: number;
}

export type QuotaEventType = 'quota:updated' | 'quota:warning' | 'quota:exceeded';

export interface QuotaEvent {
  type: QuotaEventType;
  state: QuotaState;
  timestamp: number;
}

type QuotaEventListener = (event: QuotaEvent) => void;

/**
 * Quota Tracker manages quota state and persistence
 */
export class QuotaTracker {
  private state: QuotaState | null = null;
  private listeners: Map<QuotaEventType, Set<QuotaEventListener>> = new Map();
  private storageKey = 'axia_quota_state_v1'; // Versioned for schema evolution

  constructor() {
    // Initialize event listener maps
    this.listeners.set('quota:updated', new Set());
    this.listeners.set('quota:warning', new Set());
    this.listeners.set('quota:exceeded', new Set());

    // Load persisted state on initialization
    this.loadPersistedState();
  }

  /**
   * Load quota state from chrome.storage
   */
  private async loadPersistedState(): Promise<void> {
    try {
      const stored = await chrome.storage.local.get(this.storageKey);
      if (stored[this.storageKey]) {
        this.state = stored[this.storageKey] as QuotaState;
        console.log('[QuotaTracker] Loaded persisted state:', this.state);
      }
    } catch (error) {
      console.error('[QuotaTracker] Failed to load persisted state:', error);
    }
  }

  /**
   * Persist quota state to chrome.storage
   */
  private async persistState(): Promise<void> {
    if (!this.state) return;

    try {
      await chrome.storage.local.set({
        [this.storageKey]: this.state
      });
    } catch (error) {
      console.error('[QuotaTracker] Failed to persist state:', error);
    }
  }

  /**
   * Track quota headers from RPC response
   * 
   * @param headers - Quota headers parsed from response
   */
  async trackQuota(headers: QuotaHeaders): Promise<void> {
    const { dailyLimit, dailyRemaining, monthlyLimit, monthlyRemaining, quotaReset } = headers;

    // Only update if we have quota headers
    if (dailyLimit === undefined && dailyRemaining === undefined) {
      return;
    }

    const previousState = this.state;

    // Calculate used values
    const dailyUsed = dailyLimit !== undefined && dailyRemaining !== undefined
      ? dailyLimit - dailyRemaining
      : 0;

    const monthlyUsed = monthlyLimit !== undefined && monthlyRemaining !== undefined
      ? monthlyLimit - monthlyRemaining
      : undefined;

    // Update state
    this.state = {
      dailyLimit: dailyLimit || previousState?.dailyLimit || 0,
      dailyRemaining: dailyRemaining !== undefined ? dailyRemaining : previousState?.dailyRemaining || 0,
      dailyUsed,
      monthlyLimit: monthlyLimit || previousState?.monthlyLimit,
      monthlyRemaining: monthlyRemaining !== undefined ? monthlyRemaining : previousState?.monthlyRemaining,
      monthlyUsed,
      quotaReset: quotaReset || previousState?.quotaReset,
      lastUpdated: Date.now(),
      requestCount: (previousState?.requestCount || 0) + 1
    };

    console.log('[QuotaTracker] Quota updated:', {
      daily: `${this.state.dailyRemaining}/${this.state.dailyLimit}`,
      monthly: monthlyLimit ? `${this.state.monthlyRemaining}/${this.state.monthlyLimit}` : 'N/A'
    });

    // Persist to storage
    await this.persistState();

    // Emit events
    this.emit('quota:updated', this.state);

    // Check for warnings
    if (this.shouldWarn()) {
      this.emit('quota:warning', this.state);
    }

    // Check for exceeded
    if (this.isExceeded()) {
      this.emit('quota:exceeded', this.state);
    }
  }

  /**
   * Check if quota warning threshold reached (80% used)
   */
  private shouldWarn(): boolean {
    if (!this.state) return false;

    const dailyUsagePercent = (this.state.dailyUsed / this.state.dailyLimit) * 100;
    return dailyUsagePercent >= 80 && dailyUsagePercent < 100;
  }

  /**
   * Check if quota exceeded (100% used)
   */
  private isExceeded(): boolean {
    if (!this.state) return false;
    return this.state.dailyRemaining === 0;
  }

  /**
   * Get current quota state
   */
  getState(): QuotaState | null {
    return this.state ? { ...this.state } : null;
  }

  /**
   * Get usage percentage
   */
  getUsagePercent(): { daily: number; monthly?: number } {
    if (!this.state) {
      return { daily: 0 };
    }

    const daily = (this.state.dailyUsed / this.state.dailyLimit) * 100;
    const monthly = this.state.monthlyLimit && this.state.monthlyUsed !== undefined
      ? (this.state.monthlyUsed / this.state.monthlyLimit) * 100
      : undefined;

    return { daily, monthly };
  }

  /**
   * Get time until quota reset
   */
  getTimeUntilReset(): number | null {
    if (!this.state || !this.state.quotaReset) return null;

    const resetTime = this.state.quotaReset * 1000; // Convert to ms
    const now = Date.now();
    const timeRemaining = resetTime - now;

    return Math.max(0, timeRemaining);
  }

  /**
   * Format time until reset as human-readable string
   */
  getFormattedResetTime(): string {
    const ms = this.getTimeUntilReset();
    if (ms === null) return 'Unknown';

    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  }

  /**
   * Add event listener
   */
  on(eventType: QuotaEventType, listener: QuotaEventListener): void {
    const listeners = this.listeners.get(eventType);
    if (listeners) {
      listeners.add(listener);
    }
  }

  /**
   * Remove event listener
   */
  off(eventType: QuotaEventType, listener: QuotaEventListener): void {
    const listeners = this.listeners.get(eventType);
    if (listeners) {
      listeners.delete(listener);
    }
  }

  /**
   * Emit event to all listeners
   */
  private emit(eventType: QuotaEventType, state: QuotaState): void {
    const event: QuotaEvent = {
      type: eventType,
      state: { ...state },
      timestamp: Date.now()
    };

    const listeners = this.listeners.get(eventType);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(event);
        } catch (error) {
          console.error(`[QuotaTracker] Error in ${eventType} listener:`, error);
        }
      });
    }
  }

  async fetchFromServer(userIdentityHash: string): Promise<QuotaState | null> {
    try {
      const stored = await chrome.storage.local.get(['AXIA_BASE', 'AXIA_PROJECT_ID']);
      const base = stored.AXIA_BASE;
      const projectId = stored.AXIA_PROJECT_ID;
      if (!base || !projectId) {
        console.warn('[QuotaTracker] No Axia config for server quota fetch');
        return null;
      }

      const url = `${base}/v1/${projectId}/user-quota`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'x-api-key': projectId,
          'x-user-identity-hash': userIdentityHash
        }
      });

      if (!response.ok) {
        console.warn(`[QuotaTracker] Server quota fetch failed: ${response.status}`);
        return null;
      }

      const data = await response.json();

      this.state = {
        dailyLimit: data.daily?.limit || 10000,
        dailyRemaining: Math.max(0, (data.daily?.limit || 10000) - (data.daily?.used || 0)),
        dailyUsed: data.daily?.used || 0,
        monthlyLimit: data.monthly?.limit,
        monthlyRemaining: data.monthly ? Math.max(0, data.monthly.limit - data.monthly.used) : undefined,
        monthlyUsed: data.monthly?.used,
        quotaReset: data.resetAt,
        lastUpdated: Date.now(),
        requestCount: this.state?.requestCount || 0
      };

      await this.persistState();
      this.emit('quota:updated', this.state);
      console.log('[QuotaTracker] Server quota fetched:', {
        daily: `${this.state.dailyUsed}/${this.state.dailyLimit}`,
        monthly: this.state.monthlyLimit ? `${this.state.monthlyUsed}/${this.state.monthlyLimit}` : 'N/A'
      });

      return this.state;
    } catch (error) {
      console.error('[QuotaTracker] Failed to fetch server quota:', error);
      return null;
    }
  }

  /**
   * Clear all quota state (for testing/reset)
   */
  async clear(): Promise<void> {
    this.state = null;
    await chrome.storage.local.remove(this.storageKey);
    console.log('[QuotaTracker] State cleared');
  }
}

// Singleton instance
export const quotaTracker = new QuotaTracker();
