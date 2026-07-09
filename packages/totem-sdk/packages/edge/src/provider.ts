/**
 * Provider helper functions for @totemsdk/edge.
 *
 * These functions return data structures only — they do not submit to any registry.
 * Registry, trust-index, watchlist, and lease-coordinator logic remain in
 * @totemsdk/lookup-node and future @totemsdk/proofgraph.
 */

import { sha3_256 } from '@noble/hashes/sha3.js';
import { toHex } from './canonical.js';
import { signManifest, computeManifestId } from '@totemsdk/manifest';
import type { EdgeServiceManifest, SignedManifest } from '@totemsdk/manifest';
import { bindManifestToIdentity } from '@totemsdk/identity';
import type { IdentityGraph, ManifestIdentityBinding, IdentityProofVerifier } from '@totemsdk/identity';
import type { EdgeProviderProfile, EdgeServiceRegistration } from './types.js';

export function createEdgeProviderProfile(opts: {
  operatorAddress: string;
  name: string;
  description?: string;
  tags?: string[];
}): EdgeProviderProfile {
  const { operatorAddress, name, description, tags } = opts;
  const ts = Date.now();
  const raw = `edge-provider\0${operatorAddress}\0${name}\0${ts}`;
  const hash = sha3_256(new TextEncoder().encode(raw));
  const profileId = `edge:provider:${toHex(hash)}`;
  return {
    profileId,
    operatorAddress,
    name,
    ...(description !== undefined ? { description } : {}),
    tags: tags ?? [],
    createdAt: ts,
  };
}

export function createEdgeServiceRegistration(opts: {
  profileId: string;
  serviceId: string;
  operatorAddress: string;
  expiresAt?: number;
  metadata?: Record<string, unknown>;
}): EdgeServiceRegistration {
  const { profileId, serviceId, operatorAddress, expiresAt, metadata } = opts;
  const ts = Date.now();
  const raw = `edge-svc-reg\0${profileId}\0${serviceId}\0${operatorAddress}\0${ts}`;
  const hash = sha3_256(new TextEncoder().encode(raw));
  const registrationId = `edge:registration:${toHex(hash)}`;
  return {
    registrationId,
    profileId,
    serviceId,
    operatorAddress,
    registeredAt: ts,
    ...(expiresAt !== undefined ? { expiresAt } : {}),
    ...(metadata !== undefined ? { metadata } : {}),
  };
}

export async function createEdgeServiceManifest(
  manifest: EdgeServiceManifest,
  seed: Uint8Array,
  keyIndex: number,
): Promise<SignedManifest<EdgeServiceManifest>> {
  return signManifest(manifest, seed, keyIndex);
}

export async function bindEdgeServiceIdentity(
  signedManifest: SignedManifest<EdgeServiceManifest>,
  identityGraph: IdentityGraph,
  options?: {
    proofVerifiers?: Record<string, IdentityProofVerifier>;
  },
): Promise<ManifestIdentityBinding> {
  return bindManifestToIdentity(signedManifest, identityGraph, options);
}
