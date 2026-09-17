/**
 * @module @totemsdk/storage
 *
 * Provider-neutral storage contracts and adapters.
 *
 * `@totemsdk/storage` knows nothing about QVAC, RAG workspaces, or inference. It
 * provides the durability vocabulary (write acknowledgment, failure policy,
 * capabilities), the shared value codec, namespace isolation, transaction/CAS
 * primitives, and the artifact-boundary types for content-addressed byte
 * storage behind a pluggable `ArtifactStoreBackend` port.
 *
 * The base `StorageAdapter` interface remains canonical in `@totemsdk/core`
 * (`get/set/remove/clear/keys/has`); this package re-exports and extends it, and
 * never shadows it. The dependency direction is one-way: storage → core.
 */

export * from './errors.js';
export * from './codec.js';
export * from './types.js';
export * from './namespace.js';
export * from './transaction.js';
export * from './journal.js';
export * from './snapshot.js';
export * from './adapters/memory-store.js';
export * from './artifacts/index.js';