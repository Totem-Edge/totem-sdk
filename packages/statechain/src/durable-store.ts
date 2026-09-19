/**
 * Durable client-side chain store for @totemsdk/statechain (RFC-007 Phase 4).
 *
 * Persists a caller's `StateChain` records — including the current owner's
 * pre-signed unilateral `reclaimTx` (the recovery material that must work
 * without SE cooperation) — over the shared `@totemsdk/storage` snapshot
 * primitive, with an explicit on-disk state version.
 *
 * Guarantees (mirrors RFC-007 §4.2 / §3.6 statechain row):
 * - revision-CAS writes: `save()` re-derives the next registry from the value
 *   current at the CAS point; concurrent saves are never silently lost.
 * - no silent downgrade: an adapter that cannot acknowledge at the requested
 *   durability (default `durably-acknowledged`) or that lacks conditional CAS
 *   support is rejected at construction.
 * - corruption is surfaced, never treated as absence: a record that fails the
 *   storage envelope checks, or a chain whose fields fail strict structural
 *   validation, raises `StorageError` code `corrupt`. A chain that fails
 *   `verifyChainIntegrity` at save time is refused with `write-failed`.
 * - unsupported/ambiguous *on-disk* chain snapshots are refused rather than
 *   silently reinitialised (RFC-007 §4.2 state versioning).
 *
 * Recovery boundary (RFC-007 §3.6, statechain row): the caller owns unilateral
 * recovery material. `verifyRecoverability` returns an explicit report so
 * storage-only access to a chain (without the SE) can be asserted by tools,
 * wallets, and CI — the `reclaimTx` byte-string plus the chain fields the
 * reclaim TX spends are all present in the persisted record.
 */

import type { StorageAdapter } from '@totemsdk/core';
import {
  createRevisionedSnapshotStore,
  type RevisionedSnapshotStore,
} from '@totemsdk/storage/snapshot';
import type { StorageAdapterWithCapabilities, CasStore, WriteAckMode } from '@totemsdk/storage/types';
import { StorageError } from '@totemsdk/storage/errors';
import { verifyStateChain, type VerifyOptions } from './verify.js';
import type { StateChain, StatechainOwner } from './types.js';

const DEFAULT_NAMESPACE = 'totem_statechain:v1:';

/**
 * On-disk registry format version (independent of on-chain protocol version).
 * Bumping this means old snapshots must be explicitly refused (RFC-007 §4.2) —
 * valuable state (signing history, `reclaimTx` recovery material) is never
 * silently reinitialised.
 */
export const STATECHAIN_RECORD_VERSION = 1;

/**
 * Owner snapshot as persisted: `sign` is a runtime capability (a closure over
 * the caller's WOTS key) that cannot be serialised, so it is stripped on save.
 * Every durable recovery field (`publicKeyDigest`, `transferKeySeed`) is kept;
 * a caller re-attaches signing capability when it loads a chain into memory.
 */
export type StoredStatechainOwner = Omit<StatechainOwner, 'sign'>;

/** Chain record as persisted (owner minus signing capability). */
export type StoredStateChain = Omit<StateChain, 'currentOwner'> & {
  readonly currentOwner: StoredStatechainOwner;
};

export interface StateChainRegistryState {
  readonly chains: Record<string, StoredStateChain>;
}

export interface DurableStateChainStoreOptions {
  /** Key namespace prefix; default `totem_statechain:v1:`. */
  readonly namespace?: string;
  /**
   * Required write acknowledgment; default `durably-acknowledged`. Pass
   * `volatile` only for tests/scratch adapters (e.g. `MemoryStore`).
   */
  readonly requireAckMode?: WriteAckMode;
  /**
   * Structural validation hook run over each `StateChain` at load and before
   * each save (default: a strict `verifyChainIntegrity` check).
   */
  readonly verify?: (chain: StateChain, opts?: VerifyOptions) => VerifyResult;
  /** Verification-override options (test/self-hosted SE mocks). */
  readonly verifyOptions?: VerifyOptions;
}

/**
 * Structural validation result (thin wrapper over `verifyStateChain`), kept
 * distinct from the exported `VerifyResult` in `verify.js` so the store can
 * carry a `reason` from an injected verifier without re-exporting it.
 */
export interface VerifyResult {
  valid: boolean;
  depth: number;
  rootOwner: string;
  reason?: string;
}

export interface RecoveryReport {
  /** True when a persisted `reclaimTx` exists for the chain. */
  readonly hasReclaimTx: boolean;
  /** True when the current-owner fields needed to spend the reclaim TX exist. */
  readonly ownerRecoveryMaterialPresent: boolean;
  /** True when the stored chain verifies (`verifyStateChain` passes). */
  readonly verifies: boolean;
  /** Reason when `verifies` is false. */
  readonly reason?: string;
  /** True when the chain can be recovered without SE cooperation (strict). */
  readonly recoverableWithoutSE: boolean;
}

/** Default structural check when no `verify` override is supplied. */
function defaultVerify(chain: StateChain, opts?: VerifyOptions): VerifyResult {
  const result = verifyStateChain(chain, opts);
  return {
    valid: result.valid,
    depth: result.depth,
    rootOwner: result.rootOwner,
    reason: result.reason,
  };
}

function assertRegistryState(state: StateChainRegistryState, opts: DurableStateChainStoreOptions): void {
  if (typeof state !== 'object' || state === null || Array.isArray(state)) {
    throw new StorageError('statechain registry state is not an object', 'corrupt');
  }
  const value = (state as unknown as Record<string, unknown>).chains;
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new StorageError('statechain registry state is missing section "chains"', 'corrupt');
  }
  for (const [chainId, chainRaw] of Object.entries(value as Record<string, unknown>)) {
    assertChain(chainId, chainRaw, opts);
  }
}

function assertChain(chainId: string, raw: unknown, opts: DurableStateChainStoreOptions): void {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new StorageError(`statechain record "${chainId}" is not an object`, 'corrupt', { key: chainId });
  }
  const chain = raw as Partial<StateChain>;
  // On-disk chain snapshots store `amount` as a bigint via the storage codec.
  // A snapshot that fails to round-trip (e.g. amount absent or not bigint)
  // is refused, never silently reinitialised.
  if (chain.chainId !== chainId) {
    throw new StorageError(
      `statechain record key "${chainId}" does not match record.chainId "${String(chain.chainId)}"`,
      'corrupt',
      { key: chainId },
    );
  }
  const required: Array<[string, unknown]> = [
    ['coinId', chain.coinId],
    ['tokenId', chain.tokenId],
    ['amount', chain.amount],
    ['sePublicKey', chain.sePublicKey],
    ['lockingScript', chain.lockingScript],
    ['lockingAddress', chain.lockingAddress],
    ['currentOwner', chain.currentOwner],
    ['status', chain.status],
    ['reclaimTx', chain.reclaimTx],
    ['reclaimAddress', chain.reclaimAddress],
    ['reclaimTimelock', chain.reclaimTimelock],
    ['createdAt', chain.createdAt],
  ];
  for (const [field, value] of required) {
    if (value === undefined || value === null) {
      throw new StorageError(`statechain record "${chainId}" is missing required field "${field}"`, 'corrupt', { key: chainId });
    }
  }
  if (typeof chain.reclaimTx !== 'string' || chain.reclaimTx.length === 0) {
    throw new StorageError(
      `statechain record "${chainId}" has no reclaimTx — recovery material must never be silently dropped`,
      'corrupt',
      { key: chainId },
    );
  }
  if (typeof chain.amount !== 'bigint') {
    throw new StorageError(
      `statechain record "${chainId}" has a non-bigint amount (${String(chain.amount)}) — on-disk snapshot did not round-trip`,
      'corrupt',
      { key: chainId },
    );
  }
  if (typeof chain.reclaimTimelock !== 'number') {
    throw new StorageError(`statechain record "${chainId}" has an invalid reclaimTimelock`, 'corrupt', { key: chainId });
  }
  if (opts.verify) {
    const result = opts.verify(chain as StateChain, opts.verifyOptions);
    if (!result.valid) {
      throw new StorageError(
        `statechain record "${chainId}" failed verification: ${result.reason ?? 'unknown'}`,
        'corrupt',
        { key: chainId },
      );
    }
  }
}

/**
 * Create a durable `StateChain` registry over a CAS-capable adapter.
 *
 * The whole registry is one revision-CAS snapshot record, keyed under the
 * configured namespace. A `MemoryStore` (volatile ack) requires
 * `requireAckMode: 'volatile'` — pass it explicitly so a production caller
 * can never accidentally downgrade durability (RFC-007 §4.2 no-silent-downgrade).
 */
export function createDurableStateChainStore(
  adapter: StorageAdapter,
  options: DurableStateChainStoreOptions = {},
): DurableStateChainStore {
  const withCaps = adapter as StorageAdapterWithCapabilities;
  if (!withCaps || typeof withCaps.capabilities !== 'object') {
    throw new Error(
      'createDurableStateChainStore requires a capability-declaring storage adapter ' +
      '(declare capabilities on the constructed adapter, e.g. @totemsdk/storage MemoryStore/FileStore)',
    );
  }
  const cast = adapter as StorageAdapterWithCapabilities & CasStore;
  if (typeof cast.conditionalUpdate !== 'function') {
    throw new Error('createDurableStateChainStore requires a CAS-capable storage adapter (CasStore.conditionalUpdate)');
  }

  const opts: DurableStateChainStoreOptions = options;
  const verify = opts.verify ?? defaultVerify;

  const snapshots: RevisionedSnapshotStore<StateChainRegistryState> = createRevisionedSnapshotStore(
    cast,
    {
      namespace: opts.namespace ?? DEFAULT_NAMESPACE,
      requireAckMode: opts.requireAckMode,
      empty: (): StateChainRegistryState => ({ chains: {} }),
      validate: (state) => assertRegistryState(state, { ...opts, verify }),
    },
  );

  /**
   * `currentOwner.sign` is a runtime capability (a closure over the caller's
   * WOTS key) and cannot be serialised. The durable form strips it; a caller
   * re-attaches signing capability when it loads a chain back into memory.
   * Every durable recovery field (pkd, reclaimTx, locking address, coinId,
   * amount) is retained.
   */
  function toPersistable(chain: StateChain): StoredStateChain {
    const { sign: _sign, ...ownerRecord } = chain.currentOwner;
    return { ...chain, currentOwner: ownerRecord };
  }

  return {
    async save(chain: StateChain): Promise<void> {
      const result = verify(chain, opts.verifyOptions);
      if (!result.valid) {
        throw new StorageError(
          `refusing to persist statechain "${chain.chainId}" that fails verification: ${result.reason ?? 'unknown'}`,
          'write-failed',
          { key: chain.chainId },
        );
      }
      assertChain(chain.chainId, chain, { ...opts, verify });
      const next = toPersistable(chain);
      await snapshots.mutate((state) => ({
        ...state,
        chains: { ...state.chains, [next.chainId]: next },
      }));
    },

    async get(chainId: string): Promise<StoredStateChain | undefined> {
      return (await snapshots.load()).chains[chainId];
    },

    async list(): Promise<StoredStateChain[]> {
      return Object.values((await snapshots.load()).chains);
    },

    async remove(chainId: string): Promise<boolean> {
      let removed = false;
      await snapshots.mutate((state) => {
        removed = chainId in state.chains;
        if (!removed) return state;
        const chains = { ...state.chains };
        delete chains[chainId];
        return { ...state, chains };
      });
      return removed;
    },

    getRevision: () => snapshots.getRevision(),
    hasState: () => snapshots.hasState(),
    async getSnapshot(): Promise<StateChainRegistryState> {
      return snapshots.load();
    },

    async getRecoveryReport(chainId: string): Promise<RecoveryReport> {
      const chain = (await snapshots.load()).chains[chainId];
      if (!chain) {
        return {
          hasReclaimTx: false,
          ownerRecoveryMaterialPresent: false,
          verifies: false,
          reason: `no persisted statechain "${chainId}"`,
          recoverableWithoutSE: false,
        };
      }
      return recoveryReportFor(chain, verify, opts.verifyOptions);
    },

    async verifyRecoverability(): Promise<Array<{ chainId: string; report: RecoveryReport }>> {
      const chains = Object.values((await snapshots.load()).chains);
      return chains
        .map((chain) => ({ chainId: chain.chainId, report: recoveryReportFor(chain, verify, opts.verifyOptions) }))
        .sort((a, b) => a.chainId.localeCompare(b.chainId));
    },
  };
}

function recoveryReportFor(
  chain: StoredStateChain,
  verify: (c: StateChain, o?: VerifyOptions) => VerifyResult,
  verifyOptions?: VerifyOptions,
): RecoveryReport {
  const result = verify(chain as StateChain, verifyOptions);
  const ownerRecoveryMaterialPresent =
    Boolean(chain.currentOwner) &&
    Boolean(chain.currentOwner.publicKeyDigest) &&
    typeof chain.reclaimTx === 'string' &&
    chain.reclaimTx.length > 0 &&
    typeof chain.lockingAddress === 'string' &&
    chain.lockingAddress.length > 0 &&
    chain.coinId.length > 0 &&
    typeof chain.amount === 'bigint';

  return {
    hasReclaimTx: typeof chain.reclaimTx === 'string' && chain.reclaimTx.length > 0,
    ownerRecoveryMaterialPresent,
    verifies: result.valid,
    reason: result.valid ? undefined : result.reason,
    recoverableWithoutSE: result.valid && ownerRecoveryMaterialPresent,
  };
}

export interface DurableStateChainStore {
  /** Persist a chain (create / transfer / claim state transition). */
  save(chain: StateChain): Promise<void>;
  /** Load a chain (owner signing capability is not persisted; re-attach it). */
  get(chainId: string): Promise<StoredStateChain | undefined>;
  /** All persisted chains (owner signing capability is not persisted). */
  list(): Promise<StoredStateChain[]>;
  /** Remove a chain from the registry. */
  remove(chainId: string): Promise<boolean>;
  /** Current registry transition counter (0 before the first write). */
  getRevision(): Promise<number>;
  /** True once any chain record has been persisted. */
  hasState(): Promise<boolean>;
  /** Current persisted registry state. */
  getSnapshot(): Promise<StateChainRegistryState>;
  /** Recovery report for one chain (asserts SE-independent recoverability). */
  getRecoveryReport(chainId: string): Promise<RecoveryReport>;
  /** Recovery report for every persisted chain. */
  verifyRecoverability(): Promise<Array<{ chainId: string; report: RecoveryReport }>>;
}
