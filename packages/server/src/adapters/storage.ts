/**
 * Node.js Storage Adapters
 * Provides StorageAdapter implementations for Node.js environments
 */

import * as fs from 'fs';
import * as path from 'path';
import type { StorageAdapter } from '@totemsdk/core';

export interface FileStorageAdapterOptions {
  directory: string;
  prefix?: string;
}

export class FileStorageAdapter implements StorageAdapter {
  private readonly directory: string;
  private readonly prefix: string;
  private cache = new Map<string, unknown>();

  constructor(options: FileStorageAdapterOptions) {
    this.directory = options.directory;
    this.prefix = options.prefix ?? '';
    
    if (!fs.existsSync(this.directory)) {
      fs.mkdirSync(this.directory, { recursive: true });
    }
  }

  private getFilePath(key: string): string {
    const safeKey = Buffer.from(`${this.prefix}${key}`).toString('base64url');
    return path.join(this.directory, `${safeKey}.json`);
  }

  async get<T>(key: string): Promise<T | null> {
    const cached = this.cache.get(key);
    if (cached !== undefined) {
      return cached as T;
    }

    const filePath = this.getFilePath(key);
    try {
      if (!fs.existsSync(filePath)) {
        return null;
      }
      const content = fs.readFileSync(filePath, 'utf8');
      const value = JSON.parse(content) as T;
      this.cache.set(key, value);
      return value;
    } catch {
      return null;
    }
  }

  async set<T>(key: string, value: T): Promise<void> {
    this.cache.set(key, value);
    const filePath = this.getFilePath(key);
    fs.writeFileSync(filePath, JSON.stringify(value), 'utf8');
  }

  async remove(key: string): Promise<boolean> {
    this.cache.delete(key);
    const filePath = this.getFilePath(key);
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  async clear(): Promise<void> {
    this.cache.clear();
    try {
      const files = fs.readdirSync(this.directory);
      for (const file of files) {
        if (file.endsWith('.json')) {
          fs.unlinkSync(path.join(this.directory, file));
        }
      }
    } catch {
    }
  }

  async keys(): Promise<string[]> {
    try {
      const files = fs.readdirSync(this.directory);
      return files
        .filter(f => f.endsWith('.json'))
        .map(f => {
          const base64Key = f.slice(0, -5);
          try {
            const decoded = Buffer.from(base64Key, 'base64url').toString('utf8');
            return this.prefix ? decoded.slice(this.prefix.length) : decoded;
          } catch {
            return null;
          }
        })
        .filter((k): k is string => k !== null);
    } catch {
      return [];
    }
  }

  async has(key: string): Promise<boolean> {
    if (this.cache.has(key)) {
      return true;
    }
    const filePath = this.getFilePath(key);
    return fs.existsSync(filePath);
  }
}

export class MemoryStorageAdapter implements StorageAdapter {
  private readonly storage = new Map<string, unknown>();

  async get<T>(key: string): Promise<T | null> {
    const value = this.storage.get(key);
    return value !== undefined ? (value as T) : null;
  }

  async set<T>(key: string, value: T): Promise<void> {
    this.storage.set(key, value);
  }

  async remove(key: string): Promise<boolean> {
    return this.storage.delete(key);
  }

  async clear(): Promise<void> {
    this.storage.clear();
  }

  async keys(): Promise<string[]> {
    return Array.from(this.storage.keys());
  }

  async has(key: string): Promise<boolean> {
    return this.storage.has(key);
  }
}
