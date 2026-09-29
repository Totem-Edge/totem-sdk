/**
 * @module @totemsdk/storage/persistence
 *
 * RFC-007 Amendment A (§A.3, §A.9, §A.10): the provider-neutral runtime
 * persistence contract.
 *
 * Two injectable surfaces:
 *   - `storage`   — transactional KV (metadata, references, small records)
 *   - `artifacts` — content-addressed byte store (large/evidence bytes)
 *
 * `assertPersistence()` is the single construction-time assertion. It never
 * downgrades silently: a missing surface, an insufficient acknowledgement, a
 * lenient adapter where strict was required, or a missing/read-only artifact
 * store throws `StorageError('unavailable')`.
 *
 * Scope is **collision-control only**; authorization stays above the store
 * (RFC-007 §5). `createScopedStorage` never exposes `close()` — lifecycle
 * belongs to the composition root that owns the injected adapter.
 */

import { StorageError } from './errors.js';
import { Namespace } from './namespace.js';
import { assertCapabilities } from './types.js';
import type {
  CasStore,
  ConditionalUpdater,
  FailurePolicy,
  StoreCapabilities,
  StorageAdapterWithCapabilities,
  WriteAckMode,
} from './types.js';
import type { ArtifactStore } from './artifacts/artifact-store.js';

const ACK_ORDER: Record<WriteAckMode, number> = {
  volatile: 0,
  buffered: 1,
  'durably-acknowledged': 2,
};

export interface PersistencePorts {
  readonly storage?: StorageAdapterWithCapabilities;
  readonly artifacts?: ArtifactStore;
}

/** Scope identity. Namespacing avoids collisions only, NOT authorization. */
export interface StorageScope {
  readonly principal: string;
  readonly adapter: string;
  readonly purpose: string;
  readonly domain?: string;
}

export interface PersistenceRequirement {
  /**
   * Not weakenable. `durable:true` ⇒ the required KV floor and the required
   * artifact floor are ALWAYS `'durably-acknowledged'`; an explicit non-durable
   * `acknowledge`/`artifactAcknowledge` alongside `durable:true` is a
   * contradiction and throws.
   */
  readonly durable: boolean;
  /** Desired KV floor. Meaningful when `durable:false` (or exactly the durable floor). */
  readonly acknowledge?: WriteAckMode;
  /** Desired artifact floor. Default: `acknowledge`. Meaningful when `durable:false`. */
  readonly artifactAcknowledge?: WriteAckMode;
  /** Requires atomic transactions (delegated to `assertCapabilities()`). */
  readonly atomic?: boolean;
  /** Requires conditional/CAS writes (delegated to `assertCapabilities()`). */
  readonly conditional?: boolean;
  /** Required corruption policy. Default: 'strict'. */
  readonly failurePolicy?: FailurePolicy;
  /** Derivable content ⇒ corrupt may be rebuilt (lenient recovery). */
  readonly rebuildable?: boolean;
  /** Functional requirement, independent of `durable`. */
  readonly needsArtifacts?: boolean;
  /** Requires `artifacts.capabilities.deletable`. */
  readonly needsArtifactDelete?: boolean;
}

export interface PersistenceSurfaceGuarantee {
  /** `'none'` = no surface supplied; otherwise the supplied adapter's `WriteAckMode`. */
  readonly mode: 'none' | WriteAckMode;
}

export interface EffectivePersistence {
  readonly storage: PersistenceSurfaceGuarantee;
  readonly artifacts?: PersistenceSurfaceGuarantee;
  readonly failurePolicy: FailurePolicy;
  /** true only when EVERY required surface meets its required durability. */
  readonly durable: boolean;
}

/** Scoped, capability-preserving view. No close(); lifecycle owned by caller. */
export interface ScopedStorage extends StorageAdapterWithCapabilities {
  readonly scope: StorageScope;
  /** Scoped CAS facade; keys are scope-relative. Never the raw CasStore. */
  readonly cas?: CasStore;
}

function scopePrefix(scope: StorageScope): string {
  const parts = [scope.principal, scope.adapter, scope.purpose, scope.domain]
    .filter((p): p is string => typeof p === 'string' && p.length > 0)
    .map((p) => encodeURIComponent(p));
  return `scope:${parts.join('/')}/`;
}

function isCasStore(adapter: StorageAdapterWithCapabilities): adapter is StorageAdapterWithCapabilities & CasStore {
  return typeof (adapter as Partial<CasStore>).conditionalUpdate === 'function';
}

class ScopedStorageImpl implements ScopedStorage {
  readonly scope: StorageScope;
  readonly capabilities: StoreCapabilities;
  readonly failurePolicy: FailurePolicy;
  readonly cas?: CasStore;
  private readonly ns: Namespace;

  constructor(adapter: StorageAdapterWithCapabilities, scope: StorageScope) {
    this.scope = scope;
    this.capabilities = adapter.capabilities;
    this.failurePolicy = adapter.failurePolicy;
    this.ns = new Namespace(adapter, scopePrefix(scope));
    if (isCasStore(adapter)) {
      const prefix = scopePrefix(scope);
      const casStore = adapter;
      this.cas = {
        conditionalUpdate: <T>(key: string, update: ConditionalUpdater<T>) =>
          casStore.conditionalUpdate<T>(prefix + key, update),
      };
    }
  }

  get<T>(key: string): Promise<T | null> {
    return this.ns.get<T>(key);
  }
  set<T>(key: string, value: T): Promise<void> {
    return this.ns.set(key, value);
  }
  remove(key: string): Promise<boolean> {
    return this.ns.remove(key);
  }
  clear(): Promise<void> {
    return this.ns.clear();
  }
  keys(): Promise<string[]> {
    return this.ns.keys();
  }
  has(key: string): Promise<boolean> {
    return this.ns.has(key);
  }
}

export function createScopedStorage(
  adapter: StorageAdapterWithCapabilities,
  scope: StorageScope,
): ScopedStorage {
  return new ScopedStorageImpl(adapter, scope);
}

/**
 * Validate supplied ports against a declared requirement at construction.
 * Throws `StorageError('unavailable')` on any capability/policy/config mismatch.
 * Never downgrades silently.
 */
export function assertPersistence(
  ports: PersistencePorts,
  requirement: PersistenceRequirement,
  label: string,
): EffectivePersistence {
  function unavailable(message: string): never {
    throw new StorageError(`${label}: ${message}`, 'unavailable');
  }

  const failurePolicy: FailurePolicy = requirement.failurePolicy ?? 'strict';

  // A durable requirement is not weakenable by an explicit crash-loss mode.
  if (requirement.durable && requirement.acknowledge && requirement.acknowledge !== 'durably-acknowledged') {
    unavailable(`contradictory persistence requirement (durable:true with acknowledge:'${requirement.acknowledge}')`);
  }
  if (
    requirement.durable &&
    requirement.artifactAcknowledge &&
    requirement.artifactAcknowledge !== 'durably-acknowledged'
  ) {
    unavailable(
      `contradictory persistence requirement (durable:true with artifactAcknowledge:'${requirement.artifactAcknowledge}')`,
    );
  }

  // ── KV surface ────────────────────────────────────────────────────────────
  let storage: PersistenceSurfaceGuarantee;
  if (!ports.storage) {
    if (requirement.durable) unavailable('durable persistence requires a storage adapter');
    storage = { mode: 'none' };
  } else {
    const adapter = ports.storage;
    try {
      if (requirement.durable) {
        assertCapabilities(adapter, { acknowledge: 'durably-acknowledged' });
      } else if (requirement.acknowledge) {
        assertCapabilities(adapter, { acknowledge: requirement.acknowledge });
      }
      if (requirement.atomic) assertCapabilities(adapter, { atomic: true });
      if (requirement.conditional) assertCapabilities(adapter, { conditional: true });
    } catch (err) {
      unavailable(err instanceof Error ? err.message : String(err));
    }
    if (failurePolicy === 'strict' && adapter.failurePolicy === 'lenient') {
      unavailable("adapter failurePolicy is 'lenient' but 'strict' was required");
    }
    storage = { mode: adapter.capabilities.acknowledge };
  }

  // ── Artifacts surface ─────────────────────────────────────────────────────
  let artifacts: PersistenceSurfaceGuarantee | undefined;
  if (requirement.needsArtifacts) {
    const artifactsPort = ports.artifacts;
    if (!artifactsPort) unavailable('artifacts required but no artifact store was supplied');
    const caps = artifactsPort.capabilities;
    if (!caps.writable) unavailable('artifact backend is read-only');
    const floor: WriteAckMode | undefined = requirement.durable
      ? 'durably-acknowledged'
      : requirement.artifactAcknowledge ?? requirement.acknowledge;
    if (floor && ACK_ORDER[caps.acknowledge] < ACK_ORDER[floor]) {
      unavailable(`artifact backend acknowledges '${caps.acknowledge}' but '${floor}' is required`);
    }
    if (requirement.needsArtifactDelete && !caps.deletable) {
      unavailable('artifact deletion required but the backend is not deletable');
    }
    artifacts = { mode: caps.acknowledge };
  } else if (ports.artifacts) {
    artifacts = { mode: ports.artifacts.capabilities.acknowledge };
  }

  const kvDurable = storage.mode === 'durably-acknowledged';
  const artifactsDurable = !requirement.needsArtifacts || artifacts?.mode === 'durably-acknowledged';
  const durable = Boolean(requirement.durable && kvDurable && artifactsDurable);

  return {
    storage,
    ...(artifacts ? { artifacts } : {}),
    failurePolicy,
    durable,
  };
}
