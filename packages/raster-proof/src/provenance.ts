/**
 * Derived raster provenance for @totemsdk/raster-proof.
 *
 * createDerivedRasterManifest records a raster produced from other rasters
 * (satellite scene → water mask, image set → orthomosaic, before/after →
 * change mask, …). verifyRasterDerivation checks the DECLARED provenance
 * structure — that every derivedFrom ID is supplied, parameters are present
 * when a pipeline is named, and the manifest is honestly marked as derived.
 *
 * It does NOT verify that image processing was performed correctly. That is
 * outside this package's scope.
 */

import type {
  CreateDerivedRasterManifestParams,
  RasterDerivationVerifyResult,
  RasterManifest,
} from './types.js';
import { createRasterManifest } from './manifest.js';

/**
 * Create a derived raster manifest from source rasters. sourceType is forced
 * to 'derived'; provenance.derivedFrom lists the source raster IDs.
 */
export function createDerivedRasterManifest(params: CreateDerivedRasterManifestParams): RasterManifest {
  const {
    sourceManifests,
    layerType,
    asset,
    pipelineId,
    pipelineVersion,
    parametersHash,
    modelId,
    uncertainty,
    operatorId,
    ...rest
  } = params;

  if (sourceManifests.length === 0) {
    throw new Error('a derived raster requires at least one source manifest');
  }
  if (pipelineId !== undefined && parametersHash === undefined) {
    throw new Error('parametersHash is required when pipelineId is set');
  }

  return createRasterManifest({
    sourceType: 'derived',
    layerType,
    asset,
    provenance: {
      derivedFrom: sourceManifests.map((m) => m.rasterId),
      ...(pipelineId !== undefined ? { pipelineId } : {}),
      ...(pipelineVersion !== undefined ? { pipelineVersion } : {}),
      ...(parametersHash !== undefined ? { parametersHash } : {}),
      ...(modelId !== undefined ? { modelId } : {}),
      ...(uncertainty !== undefined && uncertainty.length > 0 ? { uncertainty } : {}),
      ...(operatorId !== undefined ? { operatorId } : {}),
    },
    ...rest,
  });
}

/**
 * Structural derivation check (no source manifests required). Used both by
 * verifyRasterDerivation (with sources) and by proof verification (where the
 * signer's source rasters are not inside the proof).
 */
export function structuralDerivationCheck(
  manifest: RasterManifest,
): Omit<RasterDerivationVerifyResult, 'sourceRasterIds' | 'missingSources'> {
  const reasons: string[] = [];

  if (manifest.sourceType !== 'derived') {
    reasons.push('manifest.sourceType must be "derived"');
  }
  if (!manifest.asset || typeof manifest.asset.contentHash !== 'string' || manifest.asset.contentHash.length === 0) {
    reasons.push('derived raster must declare asset.contentHash');
  }

  const derivedFrom = manifest.provenance?.derivedFrom ?? [];
  if (derivedFrom.length === 0) {
    reasons.push('derived raster must declare provenance.derivedFrom');
  }
  if (manifest.provenance?.pipelineId !== undefined && manifest.provenance.parametersHash === undefined) {
    reasons.push('parametersHash is required when pipelineId is present');
  }
  if (manifest.provenance?.uncertainty !== undefined) {
    const bad = manifest.provenance.uncertainty.some((u) => typeof u !== 'string' || u.length === 0);
    if (bad) {
      reasons.push('provenance.uncertainty must be an array of non-empty strings');
    }
  }

  return { valid: reasons.length === 0, ...(reasons.length > 0 ? { reasons } : {}) };
}

/**
 * Verify the declared provenance structure of a derived raster manifest
 * against the supplied source manifests.
 */
export function verifyRasterDerivation(
  manifest: RasterManifest,
  sourceManifests: RasterManifest[],
): RasterDerivationVerifyResult {
  const structural = structuralDerivationCheck(manifest);
  const reasons = (structural as { reasons?: string[] }).reasons ?? [];

  const derivedFrom = manifest.provenance?.derivedFrom ?? [];
  const supplied = new Set(sourceManifests.map((m) => m.rasterId));
  const missing = derivedFrom.filter((id) => !supplied.has(id));
  if (missing.length > 0) {
    reasons.push(`derivedFrom references missing source rasters: ${missing.join(', ')}`);
  }

  return {
    valid: reasons.length === 0,
    ...(reasons.length > 0 ? { reasons } : {}),
    sourceRasterIds: derivedFrom,
    ...(missing.length > 0 ? { missingSources: missing } : {}),
    ...(manifest.provenance?.uncertainty !== undefined ? { uncertainty: manifest.provenance.uncertainty } : {}),
  };
}