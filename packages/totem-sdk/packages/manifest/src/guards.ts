/**
 * Type guards for manifest kinds.
 * Each guard accepts a raw Manifest or a SignedManifest.
 */

import type {
  Manifest,
  SignedManifest,
  AppManifest,
  CapabilityManifest,
  DAppManifest,
  EdgeServiceManifest,
} from './types.js';

type MaybeSignedOrRaw = Manifest | SignedManifest | null | undefined;

function getRawManifest(input: MaybeSignedOrRaw): Manifest | null {
  if (!input || typeof input !== 'object') return null;
  if ('manifest' in input && input.manifest && typeof input.manifest === 'object') {
    return (input as SignedManifest).manifest;
  }
  if ('type' in input) return input as Manifest;
  return null;
}

export function isAppManifest(
  input: MaybeSignedOrRaw,
): input is AppManifest | SignedManifest<AppManifest> {
  return getRawManifest(input)?.type === 'app';
}

export function isCapabilityManifest(
  input: MaybeSignedOrRaw,
): input is CapabilityManifest | SignedManifest<CapabilityManifest> {
  return getRawManifest(input)?.type === 'capability';
}

export function isDAppManifest(
  input: MaybeSignedOrRaw,
): input is DAppManifest | SignedManifest<DAppManifest> {
  return getRawManifest(input)?.type === 'dapp';
}

export function isEdgeServiceManifest(
  input: MaybeSignedOrRaw,
): input is EdgeServiceManifest | SignedManifest<EdgeServiceManifest> {
  return getRawManifest(input)?.type === 'edge-service';
}
