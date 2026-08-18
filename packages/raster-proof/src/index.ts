/**
 * @module @totemsdk/raster-proof
 *
 * Edge-capable raster and visual evidence proof primitives for Totem Edge.
 *
 * This package proves bytes, manifests, provenance, windows and declared
 * relationships. It does NOT prove that a visual interpretation is correct
 * unless a reviewer or downstream model proof says so.
 *
 * Pipeline:
 *
 *   bytes + asset metadata + spatial context + provenance
 *   → chunk hashes / Merkle root
 *   → deterministic raster manifest
 *   → window proof (optional)
 *   → Totem proof envelope
 *   → proofgraph linkage
 *
 * This is NOT a raster-processing engine: no GDAL, no GeoTIFF parsing, no
 * satellite provider APIs, no STAC, no cloud masking, no NDVI, no ML
 * segmentation, no orthomosaic generation, no tile server, no storage.
 *
 * No network, no storage, no map rendering, no GIS engine dependency.
 * SHA3-256 everywhere, safe to run on edge devices.
 */

export type {
  RasterSourceType,
  RasterAssetFormat,
  RasterLayerType,
  RasterSpatialMetadata,
  RasterAssetRef,
  RasterProvenance,
  RasterManifest,
  RasterChunk,
  RasterMerkleProof,
  RasterWindowProof,
  RasterValidationResult,
  RasterMerkleSummary,
  RasterMerkleOptions,
  CreateRasterManifestParams,
  CreateDerivedRasterManifestParams,
  CreateRasterWindowProofParams,
  RasterDerivationVerifyResult,
  CreateRasterSpatialRelationParams,
  CreateRasterProofParams,
  RasterProofVerifyResult,
} from './types.js';

export { canonicalJson, toHex } from './canonical.js';
export {
  computeRasterManifestId,
  hashRasterManifest,
  computeRasterWindowProofId,
  hashRasterWindowProof,
} from './canonical.js';

export {
  hashBytes,
  hashString,
  hashSubarray,
} from './hash.js';

export {
  DEFAULT_CHUNK_SIZE_BYTES,
  chunkBytes,
  computeMerkleRoot,
  merkleLeafHash,
  createMerkleProof,
  verifyMerkleProof,
  createRasterMerkleSummary,
} from './merkle.js';

export {
  createRasterManifest,
  validateRasterManifest,
  rasterManifestToEvidenceRef,
} from './manifest.js';

export {
  createRasterWindowProof,
  rasterWindowProofToEvidenceRef,
} from './window.js';

export {
  createDerivedRasterManifest,
  verifyRasterDerivation,
} from './provenance.js';

export {
  rasterFootprintToSpatialObject,
  createRasterSpatialRelation,
} from './spatial.js';

export {
  rasterEvidenceRefs,
  createUnsignedRasterProof,
  signRasterProof,
  verifyRasterProof,
} from './proof.js';

export {
  rasterManifestToProofGraphNode,
  rasterWindowProofToProofGraphNode,
  rasterManifestToGraphEdges,
  rasterWindowProofToGraphEdges,
  addRasterManifestToGraph,
} from './proofgraph.js';
