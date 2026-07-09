/**
 * Node.js Adapters for SDK
 * 
 * Platform-specific implementations of SDK adapter interfaces.
 */

import * as fs from 'fs/promises';
import * as path from 'path';

export interface StorageAdapter {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
  clear(): Promise<void>;
}

export interface LoggerAdapter {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, error?: Error, context?: Record<string, unknown>): void;
}

export interface TimerAdapter {
  setTimeout(callback: () => void, ms: number): NodeJS.Timeout;
  setInterval(callback: () => void, ms: number): NodeJS.Timeout;
  clearTimeout(handle: NodeJS.Timeout): void;
  clearInterval(handle: NodeJS.Timeout): void;
  now(): number;
}

export class FileStorageAdapter implements StorageAdapter {
  private storagePath: string;
  private cache: Map<string, string> = new Map();

  constructor(storagePath: string = './wallet-data') {
    this.storagePath = storagePath;
  }

  private getFilePath(key: string): string {
    const safeKey = key.replace(/[^a-zA-Z0-9_-]/g, '_');
    return path.join(this.storagePath, `${safeKey}.json`);
  }

  async get(key: string): Promise<string | null> {
    if (this.cache.has(key)) {
      return this.cache.get(key)!;
    }

    try {
      const filePath = this.getFilePath(key);
      const content = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(content);
      this.cache.set(key, data.value);
      return data.value;
    } catch {
      return null;
    }
  }

  async set(key: string, value: string): Promise<void> {
    await fs.mkdir(this.storagePath, { recursive: true });
    const filePath = this.getFilePath(key);
    await fs.writeFile(filePath, JSON.stringify({ key, value, updatedAt: Date.now() }));
    this.cache.set(key, value);
  }

  async remove(key: string): Promise<void> {
    try {
      const filePath = this.getFilePath(key);
      await fs.unlink(filePath);
      this.cache.delete(key);
    } catch {
    }
  }

  async clear(): Promise<void> {
    try {
      const files = await fs.readdir(this.storagePath);
      await Promise.all(
        files.filter(f => f.endsWith('.json'))
          .map(f => fs.unlink(path.join(this.storagePath, f)))
      );
      this.cache.clear();
    } catch {
    }
  }
}

export class ConsoleLoggerAdapter implements LoggerAdapter {
  private prefix: string;

  constructor(prefix: string = 'SDK') {
    this.prefix = prefix;
  }

  private formatContext(context?: Record<string, unknown>): string {
    if (!context || Object.keys(context).length === 0) return '';
    return ' ' + JSON.stringify(context);
  }

  debug(message: string, context?: Record<string, unknown>): void {
    console.log(`[${this.prefix}:DEBUG] ${message}${this.formatContext(context)}`);
  }

  info(message: string, context?: Record<string, unknown>): void {
    console.log(`[${this.prefix}:INFO] ${message}${this.formatContext(context)}`);
  }

  warn(message: string, context?: Record<string, unknown>): void {
    console.warn(`[${this.prefix}:WARN] ${message}${this.formatContext(context)}`);
  }

  error(message: string, error?: Error, context?: Record<string, unknown>): void {
    console.error(`[${this.prefix}:ERROR] ${message}`, error || '', this.formatContext(context));
  }
}

export class NodeTimerAdapter implements TimerAdapter {
  setTimeout(callback: () => void, ms: number): NodeJS.Timeout {
    return setTimeout(callback, ms);
  }

  setInterval(callback: () => void, ms: number): NodeJS.Timeout {
    return setInterval(callback, ms);
  }

  clearTimeout(handle: NodeJS.Timeout): void {
    clearTimeout(handle);
  }

  clearInterval(handle: NodeJS.Timeout): void {
    clearInterval(handle);
  }

  now(): number {
    return Date.now();
  }
}

export interface NodeAdapters {
  storage: StorageAdapter;
  logger: LoggerAdapter;
  timer: TimerAdapter;
}

export function createNodeAdapters(options: {
  storagePath?: string;
  logPrefix?: string;
} = {}): NodeAdapters {
  return {
    storage: new FileStorageAdapter(options.storagePath),
    logger: new ConsoleLoggerAdapter(options.logPrefix),
    timer: new NodeTimerAdapter(),
  };
}
