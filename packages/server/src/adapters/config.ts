/**
 * Node.js Config Provider
 * Provides ConfigProvider implementation for Node.js environments
 */

import type { ConfigProvider } from '@totemsdk/core';

export interface NodeConfigOptions {
  apiUrl: string;
  wsUrl: string;
  network: 'mainnet' | 'testnet' | 'devnet';
  apiKey?: string;
  additionalConfig?: Record<string, unknown>;
}

export class NodeConfigProvider implements ConfigProvider {
  private readonly config: Map<string, unknown>;
  readonly apiUrl: string;
  readonly wsUrl: string;
  readonly network: 'mainnet' | 'testnet' | 'devnet';
  readonly apiKey?: string;

  constructor(options: NodeConfigOptions) {
    this.apiUrl = options.apiUrl;
    this.wsUrl = options.wsUrl;
    this.network = options.network;
    this.apiKey = options.apiKey;

    this.config = new Map(Object.entries({
      apiUrl: options.apiUrl,
      wsUrl: options.wsUrl,
      network: options.network,
      ...(options.apiKey ? { apiKey: options.apiKey } : {}),
      ...options.additionalConfig,
    }));
  }

  get<T>(key: string): T | undefined;
  get<T>(key: string, defaultValue: T): T;
  get<T>(key: string, defaultValue?: T): T | undefined {
    const value = this.config.get(key);
    if (value === undefined) {
      return defaultValue;
    }
    return value as T;
  }

  set<T>(key: string, value: T): void {
    this.config.set(key, value);
  }

  has(key: string): boolean {
    return this.config.has(key);
  }

  getAll(): Record<string, unknown> {
    return Object.fromEntries(this.config);
  }
}

export interface EnvironmentConfigMapping {
  apiUrl?: string;
  wsUrl?: string;
  network?: string;
  apiKey?: string;
}

const DEFAULT_ENV_MAPPING: EnvironmentConfigMapping = {
  apiUrl: 'TOTEM_API_URL',
  wsUrl: 'TOTEM_WS_URL',
  network: 'TOTEM_NETWORK',
  apiKey: 'TOTEM_API_KEY',
};

export function createConfigFromEnv(envMapping?: EnvironmentConfigMapping): NodeConfigProvider {
  const mapping = { ...DEFAULT_ENV_MAPPING, ...envMapping };

  const apiUrl = mapping.apiUrl ? process.env[mapping.apiUrl] : undefined;
  const wsUrl = mapping.wsUrl ? process.env[mapping.wsUrl] : undefined;
  const network = mapping.network ? process.env[mapping.network] : undefined;
  const apiKey = mapping.apiKey ? process.env[mapping.apiKey] : undefined;

  return new NodeConfigProvider({
    apiUrl: apiUrl ?? 'https://api.totem.dev',
    wsUrl: wsUrl ?? 'wss://api.totem.dev',
    network: (network as 'mainnet' | 'testnet' | 'devnet') ?? 'testnet',
    apiKey,
  });
}
