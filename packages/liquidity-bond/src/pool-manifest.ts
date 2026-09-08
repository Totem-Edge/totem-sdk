import { F, bytesToHex, hexToBytes, scriptFromWotsPk, scriptToAddress, wotsVerifyDigest } from '@totemsdk/core';
import { verifyManifest, computeManifestId } from '@totemsdk/manifest';
import type { EdgeServiceManifest, SignedManifest } from '@totemsdk/manifest';
import { LiquidityPoolManifestError } from './errors.js';
import type {
  LiquidityPoolManifest,
  LiquidityBondVerifyResult,
  CreateLiquidityPoolManifestParams,
  VerifyLiquidityPoolManifestParams,
  OperatorAutobond,
} from './types.js';
import { canonicalJson } from './serialization.js';

export const OPERATOR_AUTOBOND_DOMAIN = 'totemsdk/liquidity-bond/pool-operator/v1';

/**
 * The payload the pool operator signs: a canonical, domain-separated commitment
 * to the load-bearing pool parameters. Signing binds the operator to these
 * parameters — an operator cannot later silently change the capacity, fees, or
 * lock terms of a pool they autobonded.
 */
export function computeOperatorAutobondPayloadHash(manifest: LiquidityPoolManifest): string {
  const scope = {
    poolId: manifest.poolId,
    asset: manifest.asset,
    totalCapacity: manifest.totalCapacity,
    lockTerms: manifest.lockTerms,
    feePolicy: manifest.feePolicy,
  };
  const json = canonicalJson(scope);
  return bytesToHex(F(new TextEncoder().encode(`${OPERATOR_AUTOBOND_DOMAIN}|${json}`)));
}

/** Sign the operator autobond. The signer must own the claimed operator address. */
export interface OperatorAutobondSigner {
  publicKeyDigest: string;
  address: string;
  sign(payloadHash: Uint8Array): Promise<Uint8Array> | Uint8Array;
}

export async function buildOperatorAutobond(
  manifest: LiquidityPoolManifest,
  signer: OperatorAutobondSigner,
  now?: number,
): Promise<OperatorAutobond> {
  const ts = now ?? Date.now();
  const payloadHash = computeOperatorAutobondPayloadHash(manifest);
  const signature = await signer.sign(hexToBytes(payloadHash));
  return {
    autobondId: `autobond-${manifest.poolId}-${ts}`,
    address: signer.address,
    publicKeyDigest: signer.publicKeyDigest,
    payloadHash,
    signature: bytesToHex(signature),
    createdAt: ts,
  };
}

/** Derive the Mx address a 32-byte WOTS pk digest controls (mirrors core wasm). */
function addressFromPkDigestHex(pkDigestHex: string): string {
  return scriptToAddress(scriptFromWotsPk(hexToBytes(pkDigestHex)));
}

/**
 * Verify an operator autobond: payload binding, address ownership, and the WOTS
 * signature over the payload. "Verified" means cryptographic checking — never a
 * declared string on the manifest.
 */
export function verifyOperatorAutobond(bond: OperatorAutobond, manifest: LiquidityPoolManifest): boolean {
  if (bond.payloadHash !== computeOperatorAutobondPayloadHash(manifest)) return false;
  if (bond.address !== addressFromPkDigestHex(bond.publicKeyDigest)) return false;
  if (manifest.operatorAddress && bond.address !== manifest.operatorAddress) return false;
  return wotsVerifyDigest(
    hexToBytes(bond.signature),
    hexToBytes(bond.payloadHash),
    hexToBytes(bond.publicKeyDigest),
  );
}

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
    operatorBond: params.operatorBond,
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

export const POOL_MANIFEST_HASH_DOMAIN = 'totemsdk/liquidity-bond/pool-manifest/v1';

export function computeLiquidityPoolManifestHash(manifest: LiquidityPoolManifest): string {
  const { signedEdgeService, ...rest } = manifest;
  const json = canonicalJson(rest);
  return bytesToHex(F(new TextEncoder().encode(`${POOL_MANIFEST_HASH_DOMAIN}|${json}`)));
}

export function verifyLiquidityPoolManifest(params: VerifyLiquidityPoolManifestParams): LiquidityBondVerifyResult {
  const { manifest, now, requireOperatorBond } = params;

  if (manifest.signedEdgeService) {
    const result = verifyManifest(manifest.signedEdgeService as SignedManifest<EdgeServiceManifest>);
    if (!result.valid) {
      return { ok: false, reason: result.reason || 'Pool manifest signature invalid', code: 'POOL_MANIFEST_INVALID' };
    }
  }

  if (requireOperatorBond && !manifest.operatorBond) {
    return {
      ok: false,
      reason: 'Pool manifest requires an operator autobond',
      code: 'POOL_MANIFEST_INVALID',
    };
  }

  if (manifest.operatorBond && !verifyOperatorAutobond(manifest.operatorBond, manifest)) {
    return {
      ok: false,
      reason: 'Pool operator autobond signature invalid',
      code: 'POOL_MANIFEST_INVALID',
    };
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
