/**
 * @module @totemsdk/node/adapters
 * Node.js adapter implementations for Totem SDK
 * 
 * Provides platform-specific implementations of SDK adapter interfaces
 * for Node.js server-side and CLI applications.
 */

export {
  FileStorageAdapter,
  MemoryStorageAdapter,
  type FileStorageAdapterOptions,
} from './storage.js';

export {
  NodeWebSocketFactory,
} from './websocket.js';

export {
  NodeHttpClient,
  createAuthedNodeHttpClient,
  type NodeHttpClientOptions,
} from './http.js';

export {
  StorageAuthProvider,
  InMemoryAuthProvider,
  EnvironmentAuthProvider,
  type StorageAuthProviderOptions,
} from './auth.js';

export {
  NodeConfigProvider,
  createConfigFromEnv,
  type NodeConfigOptions,
  type EnvironmentConfigMapping,
} from './config.js';

export {
  NodeCryptoAdapter,
} from './crypto.js';

export { DefaultTimerAdapter, ConsoleLogger, NoopLogger, NoopMetrics } from '@totemsdk/core';

import type { AdapterRegistry } from '@totemsdk/core';
import { DefaultTimerAdapter, ConsoleLogger, NoopLogger, NoopMetrics } from '@totemsdk/core';

import { FileStorageAdapter, MemoryStorageAdapter } from './storage.js';
import { NodeWebSocketFactory } from './websocket.js';
import { NodeHttpClient } from './http.js';
import { StorageAuthProvider, InMemoryAuthProvider } from './auth.js';
import { NodeConfigProvider, type NodeConfigOptions } from './config.js';
import { NodeCryptoAdapter } from './crypto.js';

export interface CreateNodeAdaptersOptions {
  config: NodeConfigOptions;
  storageDirectory?: string;
  useFileStorage?: boolean;
  enableLogging?: boolean;
  pingIntervalMs?: number;
}

export function createNodeAdapters(options: CreateNodeAdaptersOptions): AdapterRegistry {
  const storage = options.useFileStorage && options.storageDirectory
    ? new FileStorageAdapter({ directory: options.storageDirectory })
    : new MemoryStorageAdapter();

  const config = new NodeConfigProvider(options.config);
  const auth = options.useFileStorage 
    ? new StorageAuthProvider(storage)
    : new InMemoryAuthProvider();
  const websocket = new NodeWebSocketFactory(
    options.pingIntervalMs ? { pingIntervalMs: options.pingIntervalMs } : undefined
  );
  const http = new NodeHttpClient();
  const logger = options.enableLogging ? new ConsoleLogger('[Totem]') : new NoopLogger();
  const timer = new DefaultTimerAdapter();
  const crypto = new NodeCryptoAdapter();
  const metrics = new NoopMetrics();

  return {
    storage,
    auth,
    websocket,
    http,
    config,
    logger,
    timer,
    crypto,
    metrics,
  };
}

export interface CreateServerAdaptersOptions extends CreateNodeAdaptersOptions {
  authTokenEnvVar?: string;
}

export function createServerAdapters(options: CreateServerAdaptersOptions): AdapterRegistry {
  const adapters = createNodeAdapters(options);
  
  if (options.authTokenEnvVar && process.env[options.authTokenEnvVar]) {
    const storage = new MemoryStorageAdapter();
    storage.set('auth_token', process.env[options.authTokenEnvVar]);
    
    return {
      ...adapters,
      auth: new StorageAuthProvider(storage),
    };
  }
  
  return adapters;
}
