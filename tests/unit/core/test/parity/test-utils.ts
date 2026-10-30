/**
 * Parity Test Utilities
 * Shared utilities for comparing legacy vs SDK implementations
 */

import type { StorageAdapter, LoggerAdapter, TimerAdapter, TimerHandle } from '../../src/adapters';

export class MockStorageAdapter implements StorageAdapter {
  private storage = new Map<string, unknown>();
  public operations: Array<{ op: string; key: string; value?: unknown }> = [];

  async get<T>(key: string): Promise<T | null> {
    this.operations.push({ op: 'get', key });
    const value = this.storage.get(key);
    return value !== undefined ? (value as T) : null;
  }

  async set<T>(key: string, value: T): Promise<void> {
    this.operations.push({ op: 'set', key, value });
    this.storage.set(key, value);
  }

  async remove(key: string): Promise<boolean> {
    this.operations.push({ op: 'remove', key });
    return this.storage.delete(key);
  }

  async clear(): Promise<void> {
    this.operations.push({ op: 'clear', key: '*' });
    this.storage.clear();
  }

  async keys(): Promise<string[]> {
    this.operations.push({ op: 'keys', key: '*' });
    return Array.from(this.storage.keys());
  }

  async has(key: string): Promise<boolean> {
    this.operations.push({ op: 'has', key });
    return this.storage.has(key);
  }

  getSnapshot(): Record<string, unknown> {
    return Object.fromEntries(this.storage);
  }

  reset(): void {
    this.storage.clear();
    this.operations = [];
  }
}

export class MockLogger implements LoggerAdapter {
  public logs: Array<{ level: string; message: string; args: unknown[] }> = [];

  debug(message: string, ...args: unknown[]): void {
    this.logs.push({ level: 'debug', message, args });
  }

  info(message: string, ...args: unknown[]): void {
    this.logs.push({ level: 'info', message, args });
  }

  warn(message: string, ...args: unknown[]): void {
    this.logs.push({ level: 'warn', message, args });
  }

  error(message: string, ...args: unknown[]): void {
    this.logs.push({ level: 'error', message, args });
  }

  reset(): void {
    this.logs = [];
  }
}

export class MockTimerAdapter implements TimerAdapter {
  private timeouts = new Map<number, { callback: () => void; time: number }>();
  private intervals = new Map<number, { callback: () => void; interval: number; lastRun: number }>();
  private nextId = 1;
  private currentTime = 0;

  setTimeout(callback: () => void, ms: number): TimerHandle {
    const id = this.nextId++;
    this.timeouts.set(id, { callback, time: this.currentTime + ms });
    return id as unknown as TimerHandle;
  }

  setInterval(callback: () => void, ms: number): TimerHandle {
    const id = this.nextId++;
    this.intervals.set(id, { callback, interval: ms, lastRun: this.currentTime });
    return id as unknown as TimerHandle;
  }

  clearTimeout(handle: TimerHandle): void {
    this.timeouts.delete(handle as unknown as number);
  }

  clearInterval(handle: TimerHandle): void {
    this.intervals.delete(handle as unknown as number);
  }

  now(): number {
    return this.currentTime;
  }

  setNow(time: number): void {
    this.currentTime = time;
  }

  advanceTime(ms: number): void {
    const targetTime = this.currentTime + ms;
    
    while (this.currentTime < targetTime) {
      const nextTimeout = this.findNextTimeout(targetTime);
      const nextInterval = this.findNextInterval(targetTime);
      
      const nextEvent = Math.min(
        nextTimeout ?? Infinity,
        nextInterval ?? Infinity,
        targetTime
      );
      
      this.currentTime = nextEvent;
      this.runDueTimeouts();
      this.runDueIntervals();
    }
  }

  private findNextTimeout(maxTime: number): number | null {
    let next: number | null = null;
    for (const [, { time }] of this.timeouts) {
      if (time <= maxTime && (next === null || time < next)) {
        next = time;
      }
    }
    return next;
  }

  private findNextInterval(maxTime: number): number | null {
    let next: number | null = null;
    for (const [, { interval, lastRun }] of this.intervals) {
      const nextRun = lastRun + interval;
      if (nextRun <= maxTime && (next === null || nextRun < next)) {
        next = nextRun;
      }
    }
    return next;
  }

  private runDueTimeouts(): void {
    const toRun: Array<{ id: number; callback: () => void }> = [];
    for (const [id, { callback, time }] of this.timeouts) {
      if (time <= this.currentTime) {
        toRun.push({ id, callback });
      }
    }
    for (const { id, callback } of toRun) {
      this.timeouts.delete(id);
      callback();
    }
  }

  private runDueIntervals(): void {
    for (const [id, entry] of this.intervals) {
      while (entry.lastRun + entry.interval <= this.currentTime) {
        entry.lastRun += entry.interval;
        entry.callback();
      }
    }
  }

  reset(): void {
    this.timeouts.clear();
    this.intervals.clear();
    this.currentTime = 0;
    this.nextId = 1;
  }
}

export function assertDeepEqual<T>(actual: T, expected: T, path = ''): void {
  if (typeof actual !== typeof expected) {
    throw new Error(`Type mismatch at ${path}: ${typeof actual} !== ${typeof expected}`);
  }

  if (actual === null || expected === null) {
    if (actual !== expected) {
      throw new Error(`Null mismatch at ${path}: ${actual} !== ${expected}`);
    }
    return;
  }

  if (typeof actual === 'object') {
    const actualObj = actual as Record<string, unknown>;
    const expectedObj = expected as Record<string, unknown>;
    
    const actualKeys = Object.keys(actualObj).sort();
    const expectedKeys = Object.keys(expectedObj).sort();
    
    if (actualKeys.length !== expectedKeys.length) {
      throw new Error(
        `Key count mismatch at ${path}: [${actualKeys.join(',')}] !== [${expectedKeys.join(',')}]`
      );
    }
    
    for (const key of actualKeys) {
      if (!expectedKeys.includes(key)) {
        throw new Error(`Missing key at ${path}: ${key}`);
      }
      assertDeepEqual(actualObj[key], expectedObj[key], `${path}.${key}`);
    }
  } else if (actual !== expected) {
    throw new Error(`Value mismatch at ${path}: ${actual} !== ${expected}`);
  }
}

export interface ParityTestResult {
  passed: boolean;
  description: string;
  legacyOutput?: unknown;
  sdkOutput?: unknown;
  error?: string;
}

export function createParityTest(
  description: string,
  legacyFn: () => Promise<unknown>,
  sdkFn: () => Promise<unknown>
): () => Promise<ParityTestResult> {
  return async (): Promise<ParityTestResult> => {
    try {
      const [legacyOutput, sdkOutput] = await Promise.all([legacyFn(), sdkFn()]);
      
      try {
        assertDeepEqual(sdkOutput, legacyOutput);
        return { passed: true, description, legacyOutput, sdkOutput };
      } catch (e) {
        return {
          passed: false,
          description,
          legacyOutput,
          sdkOutput,
          error: e instanceof Error ? e.message : String(e),
        };
      }
    } catch (e) {
      return {
        passed: false,
        description,
        error: `Execution error: ${e instanceof Error ? e.message : String(e)}`,
      };
    }
  };
}

export async function runParityTests(
  tests: Array<() => Promise<ParityTestResult>>
): Promise<{ passed: number; failed: number; results: ParityTestResult[] }> {
  const results: ParityTestResult[] = [];
  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    const result = await test();
    results.push(result);
    if (result.passed) {
      passed++;
    } else {
      failed++;
    }
  }

  return { passed, failed, results };
}
