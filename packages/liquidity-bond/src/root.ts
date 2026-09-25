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
 *
 * `verify` is **required** (AUD-015): an optional verifier let a caller pass an
 * object with no `verify` and have every signature silently accepted.
 */
export interface RegistryRootVerifier {
  publicKeyDigest: string;
  verify(payload: Uint8Array, signature: Uint8Array, indices?: SigningIndices): boolean | Promise<boolean>;
}

export interface RegistryTransitionDelta {
  op: RegistryOperation;
  opHash: string;
  previousRoot?: string;
  root: string;
  signedAt: number;
  reason?: string;
  /** Monotonic anti-reorg sequence (#34) — must advance on every applied transition. */
  sequence?: number;
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
  /**
   * Signing indices bound into the signature. Required for signing
   * (`RegistrySigningOptions`); the other root helpers ignore it.
   */
  signIndices?: SigningIndices;
  /** Monotonic anti-reorg sequence (#34) — must advance on every applied transition. */
  sequence?: number;
  /**
   * When set, the root is computed over a filtered view of the registry —
   * e.g. verified-only positions/fees — so an attacker's signed root cannot
   * look clean over phantom state (#12).
   */
  filter?: (registry: LiquidityBondRegistryState) => LiquidityBondRegistryState;
}

/**
 * Options for `signRegistryTransition`. `signIndices` is **required** (AUD-006):
 * a reusable genesis default meant every default call signed with the same WOTS
 * leaf. Callers must supply explicitly leased indices — ideally from a
 * `@totemsdk/wots-lease` reservation — so a one-time key is never reused.
 */
export interface RegistrySigningOptions extends RegistryRootOptions {
  signIndices: SigningIndices;
}

function domainFor(opts?: RegistryRootOptions): string {
  return opts?.domain ?? DEFAULT_REGISTRY_ROOT_DOMAIN;
}

/**
 * Canonical serialization of a registry state. Excludes the volatile `updatedAt`
 * stamp AND the anchor `root`/`sequence` so identical content (and the chain
 * position) always serializes identically and a root depends only on the state
 * it commits.
 */
export function serializeRegistryState(registry: LiquidityBondRegistryState): string {
  const { updatedAt: _updatedAt, root: _root, sequence: _sequence, ...stable } = registry;
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

/**
 * The exact bytes signed/verified for a transition (AUD-013): binds the
 * resulting root to its anchor position (`previousRoot`), its anti-reorg
 * `sequence`, and the mutation (`opHash`) so a signed root cannot be replayed
 * at a forged chain position and `op.poolId` is signature-bound.
 */
export function registryTransitionPayload(
  root: string,
  previousRoot: string | undefined,
  sequence: number | undefined,
  opHash: string,
  opts?: RegistryRootOptions,
): Uint8Array {
  const domain = domainFor(opts);
  return sha3_256(
    new TextEncoder().encode(
      `${domain}|transition|${root}|prev|${previousRoot ?? 'genesis'}|seq|${sequence ?? 0}|op|${opHash}`,
    ),
  );
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
  opts: RegistrySigningOptions,
): Promise<RegistrySignedTransition> {
  if (!opts?.signIndices) {
    // Runtime guard for untyped callers (AUD-006): never fall back to a
    // reusable genesis index.
    throw new Error(
      'signRegistryTransition requires explicit signIndices (leased WOTS indices); refusing to reuse a default index',
    );
  }
  const domain = domainFor(opts);
  const signedAt = opts.signedAt ?? Date.now();
  const root = computeRegistryRoot(registry, opts);
  const indices = opts.signIndices;
  const opHash = opHashFor(op, domain);
  const signature = await signer.sign(
    registryTransitionPayload(root, opts.previousRoot, opts.sequence, opHash, { domain }),
    indices,
  );
  return {
    delta: {
      op,
      opHash,
      previousRoot: opts?.previousRoot,
      root,
      signedAt,
      reason: opts?.reason,
      sequence: opts?.sequence,
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
 *  2. require the verifier to actually check the signature (AUD-015 — no
 *     structure-only acceptance).
 */
export async function verifyRegistryRoot(
  registry: LiquidityBondRegistryState,
  root: string,
  signature: Uint8Array,
  verifier: RegistryRootVerifier,
  opts?: RegistryRootOptions,
): Promise<boolean> {
  if (computeRegistryRoot(registry, opts) !== root) return false;
  if (typeof verifier.verify !== 'function') return false;
  const payload = registryRootPayload(root, opts);
  const ok = await verifier.verify(payload, signature, opts?.signIndices);
  return ok;
}

/**
 * Root-based transition verification (#6): recompute root, then always check
 * the signature over the transition payload (anchor + sequence + op) and the
 * signer identity. A verifier without `verify` fails closed (AUD-015).
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

  if (typeof verifier.verify !== 'function') {
    reasons.push('verifier does not implement signature verification');
  } else {
    const indices = opts?.signIndices;
    const ok = await verifier.verify(
      registryTransitionPayload(
        transition.root,
        transition.delta.previousRoot,
        transition.delta.sequence,
        transition.delta.opHash,
        { ...opts, domain },
      ),
      transition.signature,
      indices,
    );
    if (!ok) reasons.push('signature is invalid');
  }

  if (opHashFor(transition.delta.op, domain) !== transition.delta.opHash) {
    reasons.push('operation hash does not bind to the signature');
  }

  return { valid: reasons.length === 0, reasons };
}

/**
 * Per-pool writer registry (#34): each pool has exactly one authorized signer.
 * A transition touching a pool must be signed by that pool's writer — an
 * operator cannot mutate another pool's state.
 */
export type PoolWriterRegistry = Record<string, string>;

export function registerPoolWriter(
  writers: PoolWriterRegistry,
  poolId: string,
  signerPublicKeyDigest: string,
): PoolWriterRegistry {
  return { ...writers, [poolId]: signerPublicKeyDigest };
}

const POOL_COLLECTIONS = [
  'commitments',
  'positions',
  'receipts',
  'allocations',
  'feeRecords',
  'withdrawals',
] as const;

function poolIdsOf(value: unknown): string[] {
  const items = Array.isArray(value) ? value : [value];
  const ids = new Set<string>();
  for (const item of items) {
    if (item && typeof item === 'object' && typeof (item as { poolId?: unknown }).poolId === 'string') {
      ids.add((item as { poolId: string }).poolId);
    }
  }
  return [...ids];
}

/**
 * The set of pool ids whose state differs between `state` and `next`
 * (AUD-014). Used to confine a writer-authorized transition to the pool it
 * declared in `op.poolId`.
 */
export function changedPoolIds(
  state: LiquidityBondRegistryState,
  next: LiquidityBondRegistryState,
): Set<string> {
  const changed = new Set<string>();
  for (const id of new Set([...Object.keys(state.pools), ...Object.keys(next.pools)])) {
    if (canonicalJson(state.pools[id]) !== canonicalJson(next.pools[id])) changed.add(id);
  }
  for (const key of POOL_COLLECTIONS) {
    const before = state[key] as Record<string, unknown>;
    const after = next[key] as Record<string, unknown>;
    for (const id of new Set([...Object.keys(before), ...Object.keys(after)])) {
      if (canonicalJson(before[id]) === canonicalJson(after[id])) continue;
      for (const poolId of poolIdsOf(after[id] ?? before[id])) changed.add(poolId);
    }
  }
  return changed;
}

/**
 * Apply a signed transition to a registry (#6/#34): a mutation is only applied
 * when its signature verifies, its `previousRoot` extends the registry's current
 * anchor root, and its `sequence` strictly advances the registry's sequence
 * (anti-reorg — a `previousRoot` resubmission after a rollback is rejected).
 * When `writers` is provided, every pool the transition touches must be signed
 * by that pool's authorized writer. Returns a new state with `root` and
 * `sequence` advanced. Without this gate anyone could fabricate a
 * `LiquidityBondRegistryState`.
 */
export async function applyRegistryTransition(
  state: LiquidityBondRegistryState,
  next: LiquidityBondRegistryState,
  transition: RegistrySignedTransition,
  verifier: RegistryRootVerifier,
  opts?: RegistryRootOptions & { writers?: PoolWriterRegistry },
): Promise<LiquidityBondRegistryState> {
  const expectedPrevious = opts?.previousRoot ?? state.root;
  if (transition.delta.previousRoot !== expectedPrevious) {
    throw new Error(
      `transition previousRoot does not extend the registry anchor (expected ${expectedPrevious ?? 'genesis'})`,
    );
  }
  const expectedSequence = (state.sequence ?? 0) + 1;
  if (transition.delta.sequence !== undefined && transition.delta.sequence !== expectedSequence) {
    throw new Error(
      `transition sequence ${transition.delta.sequence} does not advance the registry (expected ${expectedSequence})`,
    );
  }
  if (opts?.writers) {
    const targetPool = transition.delta.op.poolId;
    if (!targetPool) {
      throw new Error('a writer-authorized transition must declare op.poolId');
    }
    const authorized = opts.writers[targetPool];
    if (!authorized) {
      throw new Error(`no authorized writer registered for pool ${targetPool}`);
    }
    if (authorized !== transition.signerPublicKey) {
      throw new Error(
        `transition for pool ${targetPool} was not signed by its authorized writer`,
      );
    }
    for (const poolId of changedPoolIds(state, next)) {
      if (poolId !== targetPool) {
        throw new Error(
          `transition for pool ${targetPool} modified pool ${poolId}`,
        );
      }
    }
  }
  const verified = await verifyRegistryTransition(next, transition, verifier, opts);
  if (!verified.valid) {
    throw new Error(`cannot apply a transition that fails verification: ${verified.reasons.join('; ')}`);
  }
  return { ...next, root: transition.root, sequence: expectedSequence };
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
    opts: RegistrySigningOptions,
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
    opts?: RegistryRootOptions & { writers?: PoolWriterRegistry },
  ): Promise<LiquidityBondRegistryState>;
}

export const registryRootPort: RegistryRootPort = {
  serializeRegistryState,
  computeRegistryRoot,
  signRegistryTransition,
  verifyRegistryTransition,
  applyRegistryTransition,
};