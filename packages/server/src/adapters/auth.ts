/**
 * Node.js Auth Token Provider
 * Provides AuthTokenProvider implementations for Node.js environments
 */

import type { StorageAdapter, AuthTokenProvider } from '@totemsdk/core';

export interface StorageAuthProviderOptions {
  tokenKey?: string;
}

export class StorageAuthProvider implements AuthTokenProvider {
  private readonly storage: StorageAdapter;
  private readonly tokenKey: string;
  private readonly listeners = new Set<(token: string | null) => void>();
  private cachedToken: string | null = null;

  constructor(storage: StorageAdapter, options: StorageAuthProviderOptions = {}) {
    this.storage = storage;
    this.tokenKey = options.tokenKey ?? 'auth_token';
  }

  async getToken(): Promise<string | null> {
    if (this.cachedToken !== null) {
      return this.cachedToken;
    }
    this.cachedToken = await this.storage.get<string>(this.tokenKey);
    return this.cachedToken;
  }

  async setToken(token: string): Promise<void> {
    this.cachedToken = token;
    await this.storage.set(this.tokenKey, token);
    this.notifyListeners(token);
  }

  async clearToken(): Promise<void> {
    this.cachedToken = null;
    await this.storage.remove(this.tokenKey);
    this.notifyListeners(null);
  }

  onTokenChange(callback: (token: string | null) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  async isAuthenticated(): Promise<boolean> {
    const token = await this.getToken();
    return token !== null && token.length > 0;
  }

  private notifyListeners(token: string | null): void {
    this.listeners.forEach(listener => listener(token));
  }
}

export class InMemoryAuthProvider implements AuthTokenProvider {
  private token: string | null = null;
  private readonly listeners = new Set<(token: string | null) => void>();

  async getToken(): Promise<string | null> {
    return this.token;
  }

  async setToken(token: string): Promise<void> {
    this.token = token;
    this.listeners.forEach(listener => listener(token));
  }

  async clearToken(): Promise<void> {
    this.token = null;
    this.listeners.forEach(listener => listener(null));
  }

  onTokenChange(callback: (token: string | null) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  async isAuthenticated(): Promise<boolean> {
    return this.token !== null && this.token.length > 0;
  }
}

export class EnvironmentAuthProvider implements AuthTokenProvider {
  private readonly envVarName: string;
  private readonly listeners = new Set<(token: string | null) => void>();

  constructor(envVarName: string = 'TOTEM_AUTH_TOKEN') {
    this.envVarName = envVarName;
  }

  async getToken(): Promise<string | null> {
    return process.env[this.envVarName] ?? null;
  }

  async setToken(_token: string): Promise<void> {
    throw new Error('Cannot set environment variable token at runtime');
  }

  async clearToken(): Promise<void> {
    throw new Error('Cannot clear environment variable token at runtime');
  }

  onTokenChange(_callback: (token: string | null) => void): () => void {
    return () => {};
  }

  async isAuthenticated(): Promise<boolean> {
    const token = await this.getToken();
    return token !== null && token.length > 0;
  }
}
