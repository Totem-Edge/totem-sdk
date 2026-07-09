/**
 * AXIA CONNECTION MONITOR
 * Background service that monitors AXIA API connectivity
 * Runs periodic health checks and publishes status to chrome.storage
 */

import {
  ConnectionState,
  ConnectionStatus,
  HealthCheckResult,
  CONNECTION_STATUS_KEY,
  DEFAULT_CONNECTION_STATE,
  HEALTH_CHECK_INTERVAL_MINUTES,
  HEALTH_CHECK_TIMEOUT_MS,
  MAX_CONSECUTIVE_FAILURES,
} from './types';

export class ConnectionMonitor {
  private alarmName = 'axia-connection-health-check';
  private consecutiveFailures = 0;
  private currentState: ConnectionState = { ...DEFAULT_CONNECTION_STATE };

  constructor() {
    console.log('[ConnectionMonitor] Initialized');
  }

  async start(): Promise<void> {
    console.log('[ConnectionMonitor] Starting health monitor (MV3-safe)...');

    await this.checkConnectionNow();

    await chrome.alarms.clear(this.alarmName);

    await chrome.alarms.create(this.alarmName, {
      delayInMinutes: HEALTH_CHECK_INTERVAL_MINUTES,
      periodInMinutes: HEALTH_CHECK_INTERVAL_MINUTES,
    });

    chrome.alarms.onAlarm.addListener((alarm) => {
      if (alarm.name === this.alarmName) {
        this.checkConnectionNow();
      }
    });

    if (chrome.runtime.lastError) {
      console.error('[ConnectionMonitor] Failed to create alarm:', chrome.runtime.lastError);
    } else {
      console.log(`[ConnectionMonitor] Health checks scheduled every ${HEALTH_CHECK_INTERVAL_MINUTES} minute(s) using chrome.alarms`);
    }
  }

  async stop(): Promise<void> {
    await chrome.alarms.clear(this.alarmName);
    console.log('[ConnectionMonitor] Stopped');
  }

  async checkConnectionNow(): Promise<void> {
    console.log('[ConnectionMonitor] Running health check...');

    if (typeof self !== 'undefined' && 'navigator' in self && !self.navigator.onLine) {
      await this.updateStatus('offline', 'Network offline');
      return;
    }

    const bootstrapConfig = await this.getBootstrapConfig();
    
    if (!bootstrapConfig.AXIA_BASE || !bootstrapConfig.AXIA_PROJECT_ID) {
      console.log('[ConnectionMonitor] Bootstrap not configured');
      await this.updateStatus('offline', 'Bootstrap configuration missing');
      this.currentState.bootstrapConfigured = false;
      return;
    }

    this.currentState.bootstrapConfigured = true;
    this.currentState.rpcEndpoint = `${bootstrapConfig.AXIA_BASE}/v1/${bootstrapConfig.AXIA_PROJECT_ID}`;

    await this.updateStatus('connecting', 'Checking API health...');

    const healthResult = await this.performHealthCheck(bootstrapConfig.AXIA_BASE);

    if (healthResult.success) {
      this.consecutiveFailures = 0;
      await this.updateStatus('online', undefined, healthResult);
    } else {
      this.consecutiveFailures++;
      
      if (this.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        await this.updateStatus('error', healthResult.error || 'Health check failed', healthResult);
      } else {
        console.log(`[ConnectionMonitor] Failure ${this.consecutiveFailures}/${MAX_CONSECUTIVE_FAILURES}, retrying...`);
      }
    }
  }

  private async getBootstrapConfig(): Promise<{ AXIA_BASE?: string; AXIA_PROJECT_ID?: string }> {
    return new Promise((resolve) => {
      chrome.storage.local.get(['AXIA_BASE', 'AXIA_PROJECT_ID'], (result) => {
        resolve(result as { AXIA_BASE?: string; AXIA_PROJECT_ID?: string });
      });
    });
  }

  private async performHealthCheck(baseUrl: string): Promise<HealthCheckResult> {
    const startTime = Date.now();
    const endpoint = `${baseUrl}/totem.json`;

    try {
      console.log(`[ConnectionMonitor] Pinging ${endpoint}...`);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT_MS);

      const response = await fetch(endpoint, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
        },
      });

      clearTimeout(timeout);

      const latencyMs = Date.now() - startTime;

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.rpc_endpoint || !data.project_id) {
        throw new Error('Invalid bootstrap response (missing required fields)');
      }

      console.log(`[ConnectionMonitor] ✓ Health check passed (${latencyMs}ms)`);

      return {
        success: true,
        timestamp: Date.now(),
        latencyMs,
        endpoint,
      };
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      console.error(`[ConnectionMonitor] ✗ Health check failed (${latencyMs}ms):`, errorMessage);

      return {
        success: false,
        timestamp: Date.now(),
        latencyMs,
        error: errorMessage,
        endpoint,
      };
    }
  }

  private async updateStatus(
    status: ConnectionStatus,
    reason?: string,
    healthResult?: HealthCheckResult
  ): Promise<void> {
    const now = Date.now();

    this.currentState = {
      ...this.currentState,
      status,
      lastChecked: now,
      lastSuccess: healthResult?.success ? now : this.currentState.lastSuccess,
      lastError: healthResult?.success ? null : (healthResult?.error || reason || null),
      reason: reason || undefined,
    };

    console.log('[ConnectionMonitor] Status updated:', {
      status: this.currentState.status,
      reason: this.currentState.reason,
      lastError: this.currentState.lastError,
    });

    await chrome.storage.local.set({
      [CONNECTION_STATUS_KEY]: this.currentState,
    });

    chrome.runtime.sendMessage({
      method: 'connection:statusChanged',
      status: this.currentState,
    }).catch(() => {
    });
  }

  async getCurrentStatus(): Promise<ConnectionState> {
    return new Promise((resolve) => {
      chrome.storage.local.get([CONNECTION_STATUS_KEY], (result) => {
        resolve(result[CONNECTION_STATUS_KEY] || { ...DEFAULT_CONNECTION_STATE });
      });
    });
  }
}

export const connectionMonitor = new ConnectionMonitor();
