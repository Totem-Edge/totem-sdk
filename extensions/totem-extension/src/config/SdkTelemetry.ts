/**
 * SDK Migration Telemetry
 * 
 * Tracks SDK vs legacy mode usage for rollout monitoring.
 * Integrates with SdkMigrationManager for automatic rollback decisions.
 * 
 * Metrics tracked:
 * - Initialization success/failure rates by mode
 * - Initialization duration percentiles
 * - Error types and frequencies
 * - Rollback events
 */

import { SdkMigrationManager, type SdkInitMode, type SdkTelemetryEvent } from './SdkMigrationManager';

export interface InitMetrics {
  mode: SdkInitMode;
  startTime: number;
  endTime?: number;
  success?: boolean;
  error?: string;
  phase?: string;
}

export interface TelemetryReport {
  period: 'hour' | 'day' | 'session';
  sdkSuccessRate: number;
  legacySuccessRate: number;
  sdkAvgDuration: number;
  legacyAvgDuration: number;
  totalInits: number;
  rollbackCount: number;
  topErrors: Array<{ error: string; count: number }>;
}

class SdkTelemetryTracker {
  private currentInit: InitMetrics | null = null;
  private initHistory: InitMetrics[] = [];
  private readonly maxHistorySize = 500;

  async startInit(mode: SdkInitMode): Promise<void> {
    this.currentInit = {
      mode,
      startTime: performance.now(),
    };

    await SdkMigrationManager.trackEvent({
      type: 'init_start',
      mode,
      timestamp: Date.now(),
    });

    console.log(`[SdkTelemetry] Init started: mode=${mode}`);
  }

  async recordPhase(phase: string): Promise<void> {
    if (this.currentInit) {
      this.currentInit.phase = phase;
      console.log(`[SdkTelemetry] Phase: ${phase}`);
    }
  }

  async endInit(success: boolean, error?: string): Promise<void> {
    if (!this.currentInit) {
      console.warn('[SdkTelemetry] endInit called without startInit');
      return;
    }

    const endTime = performance.now();
    const duration = endTime - this.currentInit.startTime;

    this.currentInit.endTime = endTime;
    this.currentInit.success = success;
    this.currentInit.error = error;

    this.initHistory.push({ ...this.currentInit });

    if (this.initHistory.length > this.maxHistorySize) {
      this.initHistory = this.initHistory.slice(-this.maxHistorySize);
    }

    if (success) {
      await SdkMigrationManager.recordSuccess(duration);
      console.log(`[SdkTelemetry] Init success: mode=${this.currentInit.mode}, duration=${Math.round(duration)}ms`);
    } else {
      await SdkMigrationManager.recordError(error || 'Unknown error');
      console.error(`[SdkTelemetry] Init failure: mode=${this.currentInit.mode}, error=${error}`);
    }

    this.currentInit = null;
  }

  async wrapInit<T>(
    mode: SdkInitMode,
    initFn: () => Promise<T>
  ): Promise<T> {
    await this.startInit(mode);

    try {
      const result = await initFn();
      await this.endInit(true);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await this.endInit(false, errorMessage);
      throw error;
    }
  }

  getSessionStats(): {
    sdkInits: number;
    legacyInits: number;
    sdkSuccessRate: number;
    legacySuccessRate: number;
    sdkAvgDuration: number;
    legacyAvgDuration: number;
  } {
    const sdkInits = this.initHistory.filter(i => i.mode === 'sdk');
    const legacyInits = this.initHistory.filter(i => i.mode === 'legacy');

    const calcSuccessRate = (inits: InitMetrics[]) => {
      if (inits.length === 0) return 1;
      const successes = inits.filter(i => i.success).length;
      return successes / inits.length;
    };

    const calcAvgDuration = (inits: InitMetrics[]) => {
      const completed = inits.filter(i => i.endTime !== undefined);
      if (completed.length === 0) return 0;
      const total = completed.reduce((sum, i) => sum + (i.endTime! - i.startTime), 0);
      return total / completed.length;
    };

    return {
      sdkInits: sdkInits.length,
      legacyInits: legacyInits.length,
      sdkSuccessRate: calcSuccessRate(sdkInits),
      legacySuccessRate: calcSuccessRate(legacyInits),
      sdkAvgDuration: calcAvgDuration(sdkInits),
      legacyAvgDuration: calcAvgDuration(legacyInits),
    };
  }

  getRecentErrors(limit = 10): Array<{ mode: SdkInitMode; error: string; timestamp: number }> {
    return this.initHistory
      .filter(i => !i.success && i.error)
      .slice(-limit)
      .map(i => ({
        mode: i.mode,
        error: i.error!,
        timestamp: i.startTime,
      }));
  }

  async generateReport(period: 'hour' | 'day' | 'session'): Promise<TelemetryReport> {
    const now = Date.now();
    const cutoff = period === 'session' ? 0 :
      period === 'hour' ? now - 60 * 60 * 1000 :
      now - 24 * 60 * 60 * 1000;

    const relevantInits = this.initHistory.filter(i => i.startTime >= cutoff);

    const sdkInits = relevantInits.filter(i => i.mode === 'sdk');
    const legacyInits = relevantInits.filter(i => i.mode === 'legacy');

    const calcRate = (inits: InitMetrics[]) => {
      if (inits.length === 0) return 1;
      return inits.filter(i => i.success).length / inits.length;
    };

    const calcDuration = (inits: InitMetrics[]) => {
      const completed = inits.filter(i => i.endTime !== undefined);
      if (completed.length === 0) return 0;
      return completed.reduce((sum, i) => sum + (i.endTime! - i.startTime), 0) / completed.length;
    };

    const errorCounts = new Map<string, number>();
    relevantInits
      .filter(i => !i.success && i.error)
      .forEach(i => {
        const count = errorCounts.get(i.error!) || 0;
        errorCounts.set(i.error!, count + 1);
      });

    const topErrors = Array.from(errorCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([error, count]) => ({ error, count }));

    const telemetry = await SdkMigrationManager.getTelemetry();
    const rollbackCount = telemetry.events.filter(
      e => e.type === 'rollback' && e.timestamp >= cutoff
    ).length;

    return {
      period,
      sdkSuccessRate: calcRate(sdkInits),
      legacySuccessRate: calcRate(legacyInits),
      sdkAvgDuration: calcDuration(sdkInits),
      legacyAvgDuration: calcDuration(legacyInits),
      totalInits: relevantInits.length,
      rollbackCount,
      topErrors,
    };
  }

  reset(): void {
    this.currentInit = null;
    this.initHistory = [];
  }
}

export const sdkTelemetry = new SdkTelemetryTracker();

export async function initWithTelemetry<T>(
  sdkInit: () => Promise<T>,
  legacyInit: () => Promise<T>
): Promise<T> {
  const effectiveMode = await SdkMigrationManager.getEffectiveMode();

  try {
    if (effectiveMode === 'sdk') {
      return await sdkTelemetry.wrapInit('sdk', sdkInit);
    } else {
      return await sdkTelemetry.wrapInit('legacy', legacyInit);
    }
  } catch (error) {
    if (effectiveMode === 'sdk') {
      console.warn('[SdkTelemetry] SDK init failed, falling back to legacy');
      
      try {
        return await sdkTelemetry.wrapInit('legacy', legacyInit);
      } catch (legacyError) {
        throw legacyError;
      }
    }
    throw error;
  }
}

export async function compareInitMethods<T>(
  sdkInit: () => Promise<T>,
  legacyInit: () => Promise<T>,
  compare: (sdk: T, legacy: T) => boolean
): Promise<{ match: boolean; sdkResult?: T; legacyResult?: T; sdkError?: string; legacyError?: string }> {
  let sdkResult: T | undefined;
  let legacyResult: T | undefined;
  let sdkError: string | undefined;
  let legacyError: string | undefined;

  try {
    sdkResult = await sdkInit();
  } catch (error) {
    sdkError = error instanceof Error ? error.message : String(error);
  }

  try {
    legacyResult = await legacyInit();
  } catch (error) {
    legacyError = error instanceof Error ? error.message : String(error);
  }

  const match = sdkResult !== undefined && legacyResult !== undefined 
    ? compare(sdkResult, legacyResult)
    : false;

  if (!match && sdkResult !== undefined && legacyResult !== undefined) {
    console.warn('[SdkTelemetry] Parity mismatch detected between SDK and legacy init');
  }

  return { match, sdkResult, legacyResult, sdkError, legacyError };
}
