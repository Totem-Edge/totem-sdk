/**
 * liquidity-bond/root.ts — Registry rooting, transition deltas, and anchoring.
 *
 * A registry root is a SHA3-256 commitment over the canonical serialization of a
 * `LiquidityBondRegistryState`, with the volatile `updatedAt` stamp excluded so a
 * root is a pure function of the registry content. Signing a root anchors it so a
 * federated peer or an on-chain anchor can verify that a recorded delta still matches
 * the live state — federation and anchoring become built-in rather than hand-rolled.
 *
 * Chaining: each signed transition carries the `previousRoot` it was built on, so
 * verifiers can walk the hash chain from genesis to the tip.
 */

import { sha3_256, toHex } from '@totemsdk/core';
import { canonicalJson } from './serialization.js';
import type { LiquidityBondRegistryState } from './types.js';

export const DEFAULT_REGISTRY_ROOT_DOMAIN = 'totemsdk/liquidity-bond/registry/v1';

/** Description of what changed in a registry transition. */
export interface RegistryOperation {
  type: string;
  poolId?: string;
  positionId?: string;
  allocationId?: string;
  commitmentId?: string;
  receiptId?: string;
  withdrawalId?: string;
  amount?: bigint;
  entity?: unknown;
  metadata?: Record<string, unknown>;
}

/** Signer used to authorize registry transitions. Structurally compatible with a WOTS lease-backed signer. */
export interface RegistryTransitionSigner {
  publicKeyDigest: string;
  sign(digest: Uint8Array): Promise<Uint8Array>;
}

/** Verifier used to check a registry root signature. */
export interface RegistryRootVerifier {
  publicKeyDigest: string;
  verify?(digest: Uint8Array, signature: Uint8Array): boolean | Promise<boolean>;
}

export interface RegistryTransitionDelta {
  op: RegistryOperation;
  opHash: string;
  previousRoot?: string;
  root: string;
  signedAt: number;
  reason?: string;
}

export interface RegistrySignedTransition {
  delta: RegistryTransitionDelta;
  root: string;
  signature: Uint8Array;
  signerPublicKey: string;
  signedAt: number;
}

export interface RegistryRootOptions {
  domain?: string;
  previousRoot?: string;
  reason?: string;
  signedAt?: number;
}

function domainFor(opts?: RegistryRootOptions): string {
  return opts?.domain ?? DEFAULT_REGISTRY_ROOT_DOMAIN;
}

/**
 * Canonical serialization of a registry state. Excludes the volatile `updatedAt`
 * stamp so identical content always serializes to an identical string.
 */
export function serializeRegistryState(registry: LiquidityBondRegistryState): string {
  const { updatedAt: _updatedAt, ...stable } = registry;
  return canonicalJson(stable);
}

/**
 * SHA3-256 commitment over the canonical registry serialization, domain-scoped.
 */
export function computeRegistryRoot(
  registry: LiquidityBondRegistryState,
  opts?: RegistryRootOptions,
): string {
  const domain = domainFor(opts);
  const input = `${domain}|${serializeRegistryState(registry)}`;
  return toHex(sha3_256(new TextEncoder().encode(input)));
}

/**
 * The exact bytes a signer signs to authorize a root: SHA3-256(domain|root|root).
 */
export function registryRootPayload(root: string, opts?: RegistryRootOptions): Uint8Array {
  const domain = domainFor(opts);
  return sha3_256(new TextEncoder().encode(`${domain}|root|${root}`));
}

function opHashFor(op: RegistryOperation, domain: string): string {
  return toHex(sha3_256(new TextEncoder().encode(`${domain}|op|${canonicalJson(op)}`)));
}

/**
 * Sign a registry transition: binds the resulting state (via `root`), the mutation
 * (`op`), and the prior anchor (`previousRoot`) into one signed record.
 */
export async function signRegistryTransition(
  registry: LiquidityBondRegistryState,
  op: RegistryOperation,
  signer: RegistryTransitionSigner,
  opts?: RegistryRootOptions,
): Promise<RegistrySignedTransition> {
  const domain = domainFor(opts);
  const signedAt = opts?.signedAt ?? Date.now();
  const root = computeRegistryRoot(registry, opts);
  const signature = await signer.sign(registryRootPayload(root, { domain }));
  return {
    delta: {
      op,
      opHash: opHashFor(op, domain),
      previousRoot: opts?.previousRoot,
      root,
      signedAt,
      reason: opts?.reason,
    },
    root,
    signature: signature instanceof Uint8Array ? signature : new Uint8Array(signature),
    signerPublicKey: signer.publicKeyDigest,
    signedAt,
  };
}

/**
 * Verify a root against a registry:
 *  1. recompute the root from the registry and require it to equal `root`;
 *  2. when the verifier exposes `verify`, also check the signature over the root.
 */
export async function verifyRegistryRoot(
  registry: LiquidityBondRegistryState,
  root: string,
  signature: Uint8Array,
  verifier: RegistryRootVerifier,
  opts?: RegistryRootOptions,
): Promise<boolean> {
  if (computeRegistryRoot(registry, opts) !== root) return false;
  if (typeof verifier.verify !== 'function') return true;
  const payload = registryRootPayload(root, opts);
  return await verifier.verify(payload, signature);
}

/**
 * Full verification of a signed transition: root recompute, signature, signer
 * identity, and op hash (binds `delta.op` to the signature).
 */
export async function verifyRegistryTransition(
  registry: LiquidityBondRegistryState,
  transition: RegistrySignedTransition,
  verifier: RegistryRootVerifier,
  opts?: RegistryRootOptions,
): Promise<boolean> {
  if (!(await verifyRegistryRoot(registry, transition.root, transition.signature, verifier, opts))) {
    return false;
  }
  if (transition.signerPublicKey !== verifier.publicKeyDigest) return false;
  const domain = domainFor(opts);
  return opHashFor(transition.delta.op, domain) === transition.delta.opHash;
}

/**
 * A channel program can carry a `RegistryRootPort` so an on-chain program can
 * recompute/verify the pool anchor without pulling the full registry in.
 */
export interface RegistryRootPort {
  serializeRegistryState(registry: LiquidityBondRegistryState): string;
  computeRegistryRoot(registry: LiquidityBondRegistryState, opts?: RegistryRootOptions): string;
  signRegistryTransition(
    registry: LiquidityBondRegistryState,
    op: RegistryOperation,
    signer: RegistryTransitionSigner,
    opts?: RegistryRootOptions,
  ): Promise<RegistrySignedTransition>;
  verifyRegistryRoot(
    registry: LiquidityBondRegistryState,
    root: string,
    signature: Uint8Array,
    verifier: RegistryRootVerifier,
    opts?: RegistryRootOptions,
  ): Promise<boolean>;
  verifyRegistryTransition(
    registry: LiquidityBondRegistryState,
    transition: RegistrySignedTransition,
    verifier: RegistryRootVerifier,
    opts?: RegistryRootOptions,
  ): Promise<boolean>;
}

export const registryRootPort: RegistryRootPort = {
  serializeRegistryState,
  computeRegistryRoot,
  signRegistryTransition,
  verifyRegistryRoot,
  verifyRegistryTransition,
};