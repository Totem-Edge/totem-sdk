import { F, bytesToHex as coreBytesToHex, hexToBytes as coreHexToBytes } from '@totemsdk/core';
import { verifyManifest, computeManifestId } from '@totemsdk/manifest';
import type { EdgeServiceManifest, SignedManifest } from '@totemsdk/manifest';
import { ProviderManifestError } from './errors.js';
import type {
  ProviderBondManifest,
  ProviderBondExtension,
  ProviderBondVerifyResult,
  CreateProviderBondManifestParams,
  VerifyProviderBondManifestParams,
} from './types.js';
import { canonicalJson } from './serialization.js';

function hexToBytes(hex: string): Uint8Array {
  return coreHexToBytes(hex);
}

function bytesToHex(bytes: Uint8Array): string {
  return coreBytesToHex(bytes);
}

export function createProviderBondManifest(params: CreateProviderBondManifestParams): ProviderBondManifest {
  const edgeServiceManifestId = computeManifestId(params.edgeService);
  return {
    edgeServiceManifestId,
    edgeService: params.edgeService,
    signedEdgeService: params.signedEdgeService,
    providerBond: params.providerBond,
  };
}

export function computeProviderBondExtensionHash(extension: ProviderBondExtension): string {
  const { extensionHash, ...rest } = extension;
  const json = canonicalJson(rest);
  return bytesToHex(F(new TextEncoder().encode(json)));
}

export function computeProviderBondManifestHash(manifest: ProviderBondManifest): string {
  const { signedEdgeService, ...rest } = manifest;
  const json = canonicalJson(rest);
  return bytesToHex(F(new TextEncoder().encode(json)));
}

export function verifyProviderBondManifest(params: VerifyProviderBondManifestParams): ProviderBondVerifyResult {
  const { manifest, now } = params;

  if (manifest.signedEdgeService) {
    const result = verifyManifest(manifest.signedEdgeService as SignedManifest<EdgeServiceManifest>);
    if (!result.valid) {
      return { ok: false, reason: result.reason || 'Manifest signature invalid', code: 'MANIFEST_SIGNATURE_INVALID' };
    }
  }

  if (now !== undefined && manifest.edgeService.expiresAt !== undefined && manifest.edgeService.expiresAt < now) {
    return { ok: false, reason: 'Manifest has expired', code: 'MANIFEST_EXPIRED' };
  }

  if (manifest.providerBond.extensionHash) {
    const computed = computeProviderBondExtensionHash(manifest.providerBond);
    if (computed !== manifest.providerBond.extensionHash) {
      return { ok: false, reason: 'Provider bond extension hash mismatch', code: 'BOND_EXTENSION_HASH_MISMATCH' };
    }
  }

  return { ok: true, code: 'OK' };
}

export function assertManifestNotExpired(manifest: ProviderBondManifest, now?: number): void {
  const ts = now ?? Date.now();
  if (manifest.edgeService.expiresAt !== undefined && manifest.edgeService.expiresAt < ts) {
    throw new ProviderManifestError('Manifest has expired', 'MANIFEST_EXPIRED');
  }
}
