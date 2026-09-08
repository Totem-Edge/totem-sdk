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
import type { SigningIndices } from '@totemsdk/wots-lease';
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

/**
 * Signer used to authorize registry transitions. Aligned with Omnia's
 * `ChannelSigner` (#31): `sign(payload, indices)` so WOTS key-indices are bound
 * at signing time and a single leased key is never reused across records.
 */
export interface RegistryTransitionSigner {
  publicKeyDigest: string;
  sign(payload: Uint8Array, indices: SigningIndices): Promise<Uint8Array>;
}

/**
 * Verifier used to check a registry root signature.
 */
export interface RegistryRootVerifier {
  publicKeyDigest: string;
  verify?(payload: Uint8Array, signature: Uint8Array, indices?: SigningIndices): boolean | Promise<boolean>;
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
  /** Signing indices bound into the signature (defaults to genesis indices). */
  signIndices?: SigningIndices;
  /**
   * When set, the root is computed over a filtered view of the registry —
   * e.g. verified-only positions/fees — so an attacker's signed root cannot
   * look clean over phantom state (#12).
   */
  filter?: (registry: LiquidityBondRegistryState) => LiquidityBondRegistryState;
}

function domainFor(opts?: RegistryRootOptions): string {
  return opts?.domain ?? DEFAULT_REGISTRY_ROOT_DOMAIN;
}

function signIndicesFor(opts?: RegistryRootOptions): SigningIndices {
  return opts?.signIndices ?? { addressIndex: 0, l1: 0, l2: 0 };
}

/**
 * Canonical serialization of a registry state. Excludes the volatile `updatedAt`
 * stamp AND the anchor `root` so identical content (and the chain position)
 * always serializes identically and a root depends only on the state it commits.
 */
export function serializeRegistryState(registry: LiquidityBondRegistryState): string {
  const { updatedAt: _updatedAt, root: _root, ...stable } = registry;
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
  const view = opts?.filter ? opts.filter(registry) : registry;
  const input = `${domain}|${serializeRegistryState(view)}`;
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
  const indices = signIndicesFor(opts);
  const signature = await signer.sign(registryRootPayload(root, { domain }), indices);
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
 * Verify a root against a registry (boolean form of the transition check):
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
  const ok = await verifier.verify(payload, signature, opts?.signIndices);
  return ok;
}

/**
 * Root-based transition verification (#6): recompute root, then (when the
 * verifier exposes `verify`) check the signature and signer identity.
 */
export async function verifyRegistryTransition(
  registry: LiquidityBondRegistryState,
  transition: RegistrySignedTransition,
  verifier: RegistryRootVerifier,
  opts?: RegistryRootOptions,
): Promise<{ valid: boolean; reasons: string[] }> {
  const reasons: string[] = [];
  const domain = domainFor(opts);

  if (computeRegistryRoot(registry, opts) !== transition.root) {
    reasons.push('registry root does not match the signed transition');
  }

  if (transition.signerPublicKey !== verifier.publicKeyDigest) {
    reasons.push('transition was not signed by the expected signer');
  }

  if (typeof verifier.verify === 'function') {
    const indices = opts?.signIndices;
    const ok = await verifier.verify(registryRootPayload(transition.root, opts), transition.signature, indices);
    if (!ok) reasons.push('signature is invalid');
  }

  if (opHashFor(transition.delta.op, domain) !== transition.delta.opHash) {
    reasons.push('operation hash does not bind to the signature');
  }

  return { valid: reasons.length === 0, reasons };
}

/**
 * Apply a signed transition to a registry (#6): a mutation is only applied when
 * its signature verifies AND its `previousRoot` extends the registry's current
 * anchor root (`state.root`). Returns a new state with `root` advanced. Without
 * this gate anyone could fabricate a `LiquidityBondRegistryState`.
 */
export async function applyRegistryTransition(
  state: LiquidityBondRegistryState,
  next: LiquidityBondRegistryState,
  transition: RegistrySignedTransition,
  verifier: RegistryRootVerifier,
  opts?: RegistryRootOptions,
): Promise<LiquidityBondRegistryState> {
  const expectedPrevious = opts?.previousRoot ?? state.root;
  if (transition.delta.previousRoot !== expectedPrevious) {
    throw new Error(
      `transition previousRoot does not extend the registry anchor (expected ${expectedPrevious ?? 'genesis'})`,
    );
  }
  const verified = await verifyRegistryTransition(next, transition, verifier, opts);
  if (!verified.valid) {
    throw new Error(`cannot apply a transition that fails verification: ${verified.reasons.join('; ')}`);
  }
  return { ...next, root: transition.root };
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
  verifyRegistryTransition(
    registry: LiquidityBondRegistryState,
    transition: RegistrySignedTransition,
    verifier: RegistryRootVerifier,
    opts?: RegistryRootOptions,
  ): Promise<{ valid: boolean; reasons: string[] }>;
  applyRegistryTransition(
    state: LiquidityBondRegistryState,
    next: LiquidityBondRegistryState,
    transition: RegistrySignedTransition,
    verifier: RegistryRootVerifier,
    opts?: RegistryRootOptions,
  ): Promise<LiquidityBondRegistryState>;
}

export const registryRootPort: RegistryRootPort = {
  serializeRegistryState,
  computeRegistryRoot,
  signRegistryTransition,
  verifyRegistryTransition,
  applyRegistryTransition,
};