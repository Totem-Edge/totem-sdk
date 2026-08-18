/**
 * Raster manifest construction and validation for @totemsdk/raster-proof.
 *
 * A RasterManifest is the deterministic, content-addressed record of "what
 * this raster is, where it came from, what bytes back it, and what spatial
 * context it has". Creation is pure — no I/O, no format sniffing.
 */

import type { EvidenceRef } from '@totemsdk/proof';
import type {
  CreateRasterManifestParams,
  RasterManifest,
  RasterValidationResult,
} from './types.js';
import { computeRasterManifestId, hashRasterManifest } from './canonical.js';

const CAPTURE_SKEW_MS = 24 * 60 * 60 * 1000; // capturedAt may lag createdAt by ≤ 24h

function inLonRange(v: number): boolean {
  return Number.isFinite(v) && v >= -180 && v <= 180;
}

function inLatRange(v: number): boolean {
  return Number.isFinite(v) && v >= -90 && v <= 90;
}

/**
 * Create a deterministic RasterManifest. rasterId is computed from stable
 * fields (everything except rasterId and metadata).
 */
export function createRasterManifest(params: CreateRasterManifestParams): RasterManifest {
  const createdAt = params.createdAt ?? Date.now();
  const body: Omit<RasterManifest, 'rasterId'> = {
    sourceType: params.sourceType,
    layerType: params.layerType,
    ...(params.capturedAt !== undefined ? { capturedAt: params.capturedAt } : {}),
    createdAt,
    ...(params.deviceId !== undefined ? { deviceId: params.deviceId } : {}),
    ...(params.operatorId !== undefined ? { operatorId: params.operatorId } : {}),
    ...(params.missionId !== undefined ? { missionId: params.missionId } : {}),
    ...(params.providerId !== undefined ? { providerId: params.providerId } : {}),
    ...(params.sceneId !== undefined ? { sceneId: params.sceneId } : {}),
    asset: params.asset,
    ...(params.spatial !== undefined ? { spatial: params.spatial } : {}),
    ...(params.provenance !== undefined ? { provenance: params.provenance } : {}),
    ...(params.metadata !== undefined ? { metadata: params.metadata } : {}),
  };
  return { ...body, rasterId: computeRasterManifestId(body) };
}

/**
 * Validate the structure of a RasterManifest. Structural only — does not
 * re-hash bytes (verification of a proof envelope also recomputes the ID and
 * manifest hash).
 */
export function validateRasterManifest(manifest: RasterManifest): RasterValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (typeof manifest.rasterId !== 'string' || manifest.rasterId.length === 0) {
    errors.push('rasterId is required');
  }
  if (!manifest.sourceType) {
    errors.push('sourceType is required');
  }
  if (!manifest.layerType) {
    errors.push('layerType is required');
  }
  if (!manifest.asset || typeof manifest.asset !== 'object') {
    errors.push('asset is required');
  }
  if (manifest.asset && !manifest.asset.format) {
    errors.push('asset.format is required');
  }
  if (manifest.asset && (typeof manifest.asset.contentHash !== 'string' || manifest.asset.contentHash.length === 0)) {
    errors.push('asset.contentHash is required');
  }
  if (manifest.asset && manifest.asset.hashAlgorithm !== 'sha3-256') {
    errors.push('asset.hashAlgorithm must be sha3-256');
  }
  if (manifest.asset && manifest.asset.byteSize !== undefined && manifest.asset.byteSize < 0) {
    errors.push('asset.byteSize must be non-negative');
  }
  if (manifest.asset && manifest.asset.merkleRoot !== undefined && !/^[a-f0-9]{64}$/.test(manifest.asset.merkleRoot)) {
    errors.push('asset.merkleRoot must be 64-char lowercase hex (sha3-256)');
  }
  if (manifest.asset && manifest.asset.chunkSizeBytes !== undefined && manifest.asset.chunkSizeBytes <= 0) {
    errors.push('asset.chunkSizeBytes must be positive');
  }

  if (!Number.isFinite(manifest.createdAt) || manifest.createdAt <= 0) {
    errors.push('createdAt must be finite and positive');
  }

  if (manifest.capturedAt !== undefined) {
    if (!Number.isFinite(manifest.capturedAt) || manifest.capturedAt <= 0) {
      errors.push('capturedAt must be finite and positive');
    } else if (manifest.capturedAt > manifest.createdAt + CAPTURE_SKEW_MS) {
      const allowed = manifest.metadata?.['allowFutureCapture'] === true;
      if (!allowed) {
        errors.push('capturedAt is far after createdAt; set metadata.allowFutureCapture = true to allow');
      } else {
        warnings.push('capturedAt is far after createdAt (explicitly allowed by metadata.allowFutureCapture)');
      }
    }
  }

  if (manifest.spatial) {
    if (manifest.spatial.bounds !== undefined) {
      const b = manifest.spatial.bounds;
      if (b.length !== 4) {
        errors.push('spatial.bounds must be [minLon, minLat, maxLon, maxLat]');
      } else {
        const [minLon, minLat, maxLon, maxLat] = b;
        if (!inLonRange(minLon) || !inLonRange(maxLon)) {
          errors.push('spatial.bounds longitudes must be in [-180, 180]');
        }
        if (!inLatRange(minLat) || !inLatRange(maxLat)) {
          errors.push('spatial.bounds latitudes must be in [-90, 90]');
        }
        if (minLon > maxLon) errors.push('spatial.bounds minLon must be <= maxLon');
        if (minLat > maxLat) errors.push('spatial.bounds minLat must be <= maxLat');
      }
    }
    if (manifest.spatial.widthPx !== undefined && (!Number.isInteger(manifest.spatial.widthPx) || manifest.spatial.widthPx <= 0)) {
      errors.push('spatial.widthPx must be a positive integer');
    }
    if (manifest.spatial.heightPx !== undefined && (!Number.isInteger(manifest.spatial.heightPx) || manifest.spatial.heightPx <= 0)) {
      errors.push('spatial.heightPx must be a positive integer');
    }
    if (manifest.spatial.resolutionM !== undefined && (!Number.isFinite(manifest.spatial.resolutionM) || manifest.spatial.resolutionM <= 0)) {
      errors.push('spatial.resolutionM must be positive');
    }
  }

  if (manifest.sourceType === 'derived') {
    const derivedFrom = manifest.provenance?.derivedFrom ?? [];
    if (derivedFrom.length === 0) {
      warnings.push('derived raster should declare provenance.derivedFrom source raster IDs');
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Convert a RasterManifest into an EvidenceRef for inclusion in a proof.
 */
export function rasterManifestToEvidenceRef(manifest: RasterManifest): EvidenceRef {
  return {
    id: manifest.rasterId,
    kind: 'raster-manifest',
    hash: hashRasterManifest(manifest),
  };
}
