/**
 * @totemsdk/raster-proof — Type definitions
 *
 * Pure schema for raster and visual evidence proofs.
 *
 * This package proves bytes, manifests, provenance, windows and declared
 * relationships. It does NOT process raster bytes — no decoding, no GDAL,
 * no cloud masking, no NDVI, no ML. It only hashes bytes and records the
 * metadata that makes them verifiable.
 *
 * No network, no storage, no map rendering, no GIS engine dependency.
 */

export type RasterSourceType =
  | 'satellite'
  | 'drone'
  | 'camera'
  | 'robot-camera'
  | 'thermal-camera'
  | 'lidar-derived'
  | 'radar'
  | 'map-tile'
  | 'derived'
  | 'manual-import'
  | 'other';

export type RasterAssetFormat =
  | 'geotiff'
  | 'cog'
  | 'png'
  | 'jpeg'
  | 'webp'
  | 'mbtiles'
  | 'zarr'
  | 'npy'
  | 'raw'
  | 'other';

export type RasterLayerType =
  | 'rgb'
  | 'thermal'
  | 'multispectral'
  | 'sar'
  | 'lidar-derived'
  | 'depth'
  | 'change-mask'
  | 'water-mask'
  | 'vegetation-mask'
  | 'bare-earth-mask'
  | 'cloud-mask'
  | 'uncertainty-mask'
  | 'custom';

/**
 * Spatial context for a raster asset. Bounds are GeoJSON order:
 * [minLon, minLat, maxLon, maxLat] (WGS84 / EPSG:4326).
 */
export interface RasterSpatialMetadata {
  crs?: string;
  bounds?: [number, number, number, number]; // minLon, minLat, maxLon, maxLat
  resolutionM?: number;
  widthPx?: number;
  heightPx?: number;
  /** totem:geo:<hex> hash of the footprint geometry (via @totemsdk/spatial-proof). */
  geometryHash?: string;
  /** totem:spatial:<hex> spatial object ID the footprint maps to. */
  spatialObjectId?: string;
}

export interface RasterAssetRef {
  uri?: string;
  mediaType?: string;
  format: RasterAssetFormat;
  byteSize?: number;
  contentHash: string;
  hashAlgorithm: 'sha3-256';
  merkleRoot?: string;
  chunkSizeBytes?: number;
}

export interface RasterProvenance {
  derivedFrom?: string[];
  pipelineId?: string;
  pipelineVersion?: string;
  parametersHash?: string;
  operatorId?: string;
  modelId?: string;
  uncertainty?: string[];
  metadata?: Record<string, unknown>;
}

export interface RasterManifest {
  rasterId: string; // totem:raster:<sha3-256-hex>
  sourceType: RasterSourceType;
  layerType: RasterLayerType;
  capturedAt?: number;
  createdAt: number;
  deviceId?: string;
  operatorId?: string;
  missionId?: string;
  providerId?: string;
  sceneId?: string;
  asset: RasterAssetRef;
  spatial?: RasterSpatialMetadata;
  provenance?: RasterProvenance;
  metadata?: Record<string, unknown>;
}

export interface RasterChunk {
  index: number;
  offset: number;
  length: number;
  hash: string;
}

export interface RasterMerkleProof {
  root: string;
  leafHash: string;
  leafIndex: number;
  siblings: Array<{
    position: 'left' | 'right';
    hash: string;
  }>;
  hashAlgorithm: 'sha3-256';
}

export interface RasterWindowProof {
  windowProofId: string; // totem:raster-window:<sha3-256-hex>
  rasterId: string;
  merkleRoot: string;
  chunkIndices: number[];
  chunkHashes: string[];
  spatial?: RasterSpatialMetadata;
  createdAt: number;
  metadata?: Record<string, unknown>;
}

export interface RasterValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface RasterMerkleSummary {
  contentHash: string;
  merkleRoot: string;
  chunkSizeBytes: number;
  chunkCount: number;
  byteSize: number;
}

export interface RasterMerkleOptions {
  chunkSizeBytes?: number;
}

export interface CreateRasterManifestParams {
  sourceType: RasterSourceType;
  layerType: RasterLayerType;
  asset: RasterAssetRef;
  capturedAt?: number;
  createdAt?: number;
  deviceId?: string;
  operatorId?: string;
  missionId?: string;
  providerId?: string;
  sceneId?: string;
  spatial?: RasterSpatialMetadata;
  provenance?: RasterProvenance;
  metadata?: Record<string, unknown>;
}

export interface CreateDerivedRasterManifestParams {
  sourceManifests: RasterManifest[];
  layerType: RasterLayerType;
  asset: RasterAssetRef;
  capturedAt?: number;
  createdAt?: number;
  deviceId?: string;
  operatorId?: string;
  missionId?: string;
  providerId?: string;
  sceneId?: string;
  spatial?: RasterSpatialMetadata;
  pipelineId?: string;
  pipelineVersion?: string;
  parametersHash?: string;
  modelId?: string;
  uncertainty?: string[];
  metadata?: Record<string, unknown>;
}

export interface CreateRasterWindowProofParams {
  rasterId: string;
  merkleRoot: string;
  chunkIndices: number[];
  chunkHashes: string[];
  spatial?: RasterSpatialMetadata;
  createdAt?: number;
  metadata?: Record<string, unknown>;
}

export interface RasterDerivationVerifyResult {
  valid: boolean;
  reasons?: string[];
  sourceRasterIds?: string[];
  missingSources?: string[];
  uncertainty?: string[];
}

export interface CreateRasterSpatialRelationParams {
  manifest: RasterManifest;
  /** Spatial object from @totemsdk/spatial-proof (site boundary, zone, route, …). */
  spatialObject: import('@totemsdk/spatial-proof').SpatialObject;
  relation: import('@totemsdk/spatial-proof').SpatialRelationType;
  computedAt?: number;
  maxDistanceM?: number;
  subjectProofId?: string;
  metadata?: Record<string, unknown>;
}

export interface CreateRasterProofParams {
  manifest: RasterManifest;
  windowProof?: RasterWindowProof;
  /** Full Merkle proofs for chunks referenced by windowProof (optional, enables leaf-level verification). */
  merkleProofs?: RasterMerkleProof[];
  /** Spatial object ID referenced by the raster footprint (added as evidence ref). */
  spatialObjectId?: string;
  issuer?: string;
  issuedAt?: number;
  expiresAt?: number;
}

export interface RasterProofVerifyResult {
  valid: boolean;
  reason?: string;
  signerAddress?: string;
  rasterId?: string;
  payloadValid?: boolean;
  rasterIdValid?: boolean;
  manifestHashValid?: boolean;
  windowProofValid?: boolean;
  derivationValid?: boolean;
}
