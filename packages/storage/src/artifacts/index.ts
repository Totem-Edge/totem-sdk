/**
 * @module @totemsdk/storage/artifacts
 *
 * Artifact boundary types and the pluggable `ArtifactStoreBackend` port.
 *
 * Content-addressed artifact references live alongside a local journal/retention
 * index; the bytes themselves move through the backend port. Any external store
 * (local fs, Arweave, Filecoin, IPFS, torrents, Drive, object stores) is
 * adapted behind this port rather than proliferating SDK integrations.
 */

export type { ArtifactStoreBackend, ArtifactRef, ArtifactReadStatus, ArtifactRead, PutOptions, PutReceipt, ArtifactBackendCapabilities, ArtifactIndexEntry } from './types.js';
export { ARTIFACT_DEFAULT_ALGORITHM, artifactRefId } from './types.js';
export { ArtifactStore } from './artifact-store.js';