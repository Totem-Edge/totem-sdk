/**
 * Identity document creation and ID computation.
 *
 * computeIdentityId: deterministic SHA3-256 of "totem-identity" + kind + rootAddress.
 * Version is NOT part of the ID hash — schema version upgrades must not change the identity ID.
 */

import { sha3_256 } from '@noble/hashes/sha3.js';
import { IDENTITY_VERSION } from './constants.js';
import { toHex } from './canonical.js';
import type { IdentityKind, TotemIdentityDocument } from './types.js';

export function computeIdentityId(kind: IdentityKind, rootAddress: string): string {
  const input = `totem-identity\0${kind}\0${rootAddress}`;
  const hash = sha3_256(new TextEncoder().encode(input));
  return `totem:id:${kind}:${toHex(hash)}`;
}

export function createIdentityDocument(opts: {
  kind: IdentityKind;
  rootAddress: string;
  controllerAddress: string;
  metadata?: Record<string, unknown>;
}): TotemIdentityDocument {
  const { kind, rootAddress, controllerAddress, metadata } = opts;
  return {
    id: computeIdentityId(kind, rootAddress),
    kind,
    version: IDENTITY_VERSION,
    rootAddress,
    controllerAddress,
    createdAt: Date.now(),
    ...(metadata !== undefined ? { metadata } : {}),
  };
}
