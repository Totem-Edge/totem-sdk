export type { OmniaHostConfig } from './config.js';
export { loadConfigFromEnv } from './config.js';
export type { OmniaHost } from './lifecycle.js';
export { createOmniaHost } from './lifecycle.js';
export type { HostSigning } from './signing.js';
export {
  createHostSigning,
  hasSigningMaterial,
  JsonFileStorageAdapter,
  leaseStorageDir,
  encryptSeedForKeyfile,
} from './signing.js';
export type { HostIdentity, HostIdentityAndManifest } from './identity.js';
export {
  createHostIdentityAndManifest,
  createHostManifest,
  loadHostIdentity,
} from './identity.js';
export { SqliteChannelStore } from './stores/sqlite-store.js';
export { OperationStore } from './stores/operations.js';
export type { OperationRecord, OperationStatus } from './stores/operations.js';
export { SqliteAuditStore, createAuditRecorder } from './stores/audit.js';
export type { SignerAuditEntry } from './stores/audit.js';
export { createTotemNodeAdapter } from './chain/totem-node-adapter.js';
export type { TotemNodeAdapter, TotemNodeAdapterOptions, ConfirmationOptions } from './chain/totem-node-adapter.js';
export { InProcessRoutingProvider } from './router/routing-provider.js';
export type { RoutingProvider, RouteQuery } from './router/routing-provider.js';
export { GoRoutingProvider } from './router/go-routing-provider.js';
export { createHostMethods } from './api/methods.js';
export type { HostApiContext } from './api/methods.js';
export type { OperationStoreLike } from './api/methods.js';
export { DisabledAnalyticsStore, DuckDbAnalyticsStore, initializeDuckDb } from './stores/analytics.js';
export type { AnalyticsEvent, AnalyticsStore, DuckDbConnection } from './stores/analytics.js';
export { createLocalSignerPort, createPolicySignerPort } from './signer-port.js';
export type { SignerAuditRecord, SignerPolicy } from './signer-port.js';

// Durable, replayable observation feed (RFC-0011 Amendment A).
export * from './observe/index.js';
