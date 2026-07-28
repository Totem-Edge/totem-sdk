import { F, bytesToHex, hexToBytes } from '@totemsdk/core';
import { verifyManifest, computeManifestId } from '@totemsdk/manifest';
import type { EdgeServiceManifest, SignedManifest } from '@totemsdk/manifest';
import { LiquidityPoolManifestError } from './errors.js';
import type {
  LiquidityPoolManifest,
  LiquidityBondVerifyResult,
  CreateLiquidityPoolManifestParams,
  VerifyLiquidityPoolManifestParams,
} from './types.js';
import { canonicalJson } from './serialization.js';

export function createLiquidityPoolManifest(params: CreateLiquidityPoolManifestParams): LiquidityPoolManifest {
  const now = params.createdAt ?? Date.now();
  const edgeServiceManifestId = params.edgeService ? computeManifestId(params.edgeService) : undefined;
  return {
    poolId: params.poolId,
    edgeServiceManifestId,
    edgeService: params.edgeService,
    signedEdgeService: params.signedEdgeService,
    poolType: params.poolType,
    purpose: params.purpose,
    asset: params.asset,
    operatorIdentityId: params.operatorIdentityId,
    operatorAddress: params.operatorAddress,
    providerBondRef: params.providerBondRef,
    minCommitment: params.minCommitment,
    maxCommitment: params.maxCommitment,
    totalCapacity: params.totalCapacity,
    lockTerms: params.lockTerms,
    feePolicy: params.feePolicy,
    riskPolicy: params.riskPolicy,
    createdAt: now,
    expiresAt: params.expiresAt,
    metadata: params.metadata,
  };
}

export function computeLiquidityPoolManifestHash(manifest: LiquidityPoolManifest): string {
  const { signedEdgeService, ...rest } = manifest;
  const json = canonicalJson(rest);
  return bytesToHex(F(new TextEncoder().encode(json)));
}

export function verifyLiquidityPoolManifest(params: VerifyLiquidityPoolManifestParams): LiquidityBondVerifyResult {
  const { manifest, now } = params;

  if (manifest.signedEdgeService) {
    const result = verifyManifest(manifest.signedEdgeService as SignedManifest<EdgeServiceManifest>);
    if (!result.valid) {
      return { ok: false, reason: result.reason || 'Pool manifest signature invalid', code: 'POOL_MANIFEST_INVALID' };
    }
  }

  if (now !== undefined && manifest.expiresAt !== undefined && manifest.expiresAt < now) {
    return { ok: false, reason: 'Pool manifest has expired', code: 'POOL_MANIFEST_EXPIRED' };
  }

  return { ok: true, code: 'OK' };
}

export function assertLiquidityPoolManifestNotExpired(manifest: LiquidityPoolManifest, now?: number): void {
  const ts = now ?? Date.now();
  if (manifest.expiresAt !== undefined && manifest.expiresAt < ts) {
    throw new LiquidityPoolManifestError('Pool manifest has expired', 'POOL_MANIFEST_EXPIRED');
  }
}
