/**
 * @module @totemsdk/storage/snapshot
 *
 * Revision-CAS snapshot store: a single-key, whole-value record that is
 * read-modify-written atomically through `conditionalUpdate`, with an
 * explicit in-record state version. This is the reusable primitive behind the
 * RFC-007 "revision-CAS update ... in one commit" contract — domain registries
 * (bond/claim registries, `ActionStorage`, VTXO/pool snapshots) keep their
 * authoritative state as one versioned record and never fall back to
 * read-then-write races.
 *
 * Guarantees (RFC-007 §4.2):
 * - revision-CAS writes: every `mutate()` re-derives the next record from the
 *   value current at the CAS point, so concurrent updates are never silently
 *   lost.
 * - no silent downgrade: an adapter that cannot acknowledge at the requested
 *   durability (default `durably-acknowledged`) or that lacks `conditional`
 *   CAS support is rejected at construction.
 * - corruption is surfaced, never treated as absence: an undecodable or
 *   structurally invalid record, or a record with an unsupported state
 *   version, raises `StorageError` code `corrupt`.
 */

import type { StorageAdapter } from './types.js';
import {
  assertCapabilities,
  type CasStore,
  type StorageAdapterWithCapabilities,
  type WriteAckMode,
} from './types.js';
import { StorageError } from './errors.js';

/**
 * On-disk record version. Bumping this means old records must be explicitly
 * refused (never silently reinitialised).
 */
export const SNAPSHOT_RECORD_VERSION = 1;

export interface SnapshotRecord<T> {
  /** In-record format version (`SNAPSHOT_RECORD_VERSION`). */
  readonly version: number;
  /** Monotonic transition counter — advanced on every mutation. */
  readonly revision: number;
  readonly state: T;
  readonly savedAt: number;
}

export interface RevisionedSnapshotStore<T> {
  /** Current stored state (`empty()` result when no record exists yet). */
  load(): Promise<T>;
  /** Current record envelope, including `revision`. */
  getRecord(): Promise<SnapshotRecord<T>>;
  /** Current transition counter (0 when no record exists). */
  getRevision(): Promise<number>;
  /** True when a record has been persisted. */
  hasState(): Promise<boolean>;
  /** Apply a whole-state transition under revision-CAS. */
  mutate(update: (state: T) => T): Promise<SnapshotRecord<T>>;
}

export interface RevisionedSnapshotStoreOptions<T> {
  /** Key namespace prefix; default `totem_snapshot:v1:`. */
  readonly namespace?: string;
  /**
   * Required write acknowledgment; default `durably-acknowledged`. Pass
   * `volatile` only for tests/scratch adapters (e.g. `MemoryStore`).
   */
  readonly requireAckMode?: WriteAckMode;
  /** Build a pristine state when no record exists. */
  readonly empty: () => T;
  /**
   * Structural validation hook run over a loaded state. Throw
   * `StorageError('corrupt')` for anything a consumer refuses to open —
   * corruption is surfaced, never treated as absence.
   */
  readonly validate?: (state: T) => void | never;
}

const DEFAULT_NAMESPACE = 'totem_snapshot:v1:';
const SNAPSHOT_KEY = 'snapshot';

/**
 * Persistable values are JSON-clean by contract (the codec rejects bare
 * `undefined` rather than silently dropping it): object keys with undefined
 * values are removed and undefined array entries become `null`, matching
 * `JSON.stringify` semantics while preserving bigint and Uint8Array values.
 */
function jsonClean(value: unknown): unknown {
  if (value === undefined) return null;
  if (value === null || typeof value !== 'object') return value;
  // Preserve bytes and bigint-likes verbatim for the codec (which round-trips
  // Uint8Array/<bigint> through in-band tags); never flatten them to objects.
  if (value instanceof Uint8Array) return value;
  if (Array.isArray(value)) {
    return value.map((item) => jsonClean(item));
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (v === undefined) continue;
    out[k] = jsonClean(v);
  }
  return out;
}

function isRecordLike(raw: unknown): raw is Partial<SnapshotRecord<unknown>> {
  return typeof raw === 'object' && raw !== null;
}

function withStorageLock<V>(adapter: StorageAdapter, fn: () => Promise<V>): Promise<V> {
  const tail = locks.get(adapter);
  const next = tail ? tail.then(fn, fn) : fn();
  const settled = next.catch(() => undefined);
  locks.set(adapter, settled);
  return next;
}

const locks = new WeakMap<StorageAdapter, Promise<unknown>>();

export function createRevisionedSnapshotStore<T>(
  adapter: StorageAdapterWithCapabilities & CasStore,
  options: RevisionedSnapshotStoreOptions<T>,
): RevisionedSnapshotStore<T> {
  assertCapabilities(adapter, {
    acknowledge: options.requireAckMode ?? 'durably-acknowledged',
    conditional: true,
  });

  if (typeof options.empty !== 'function') {
    throw new Error('snapshot store requires an empty() state factory');
  }
  const validate = options.validate ?? (() => undefined);
  const key = (options.namespace ?? DEFAULT_NAMESPACE) + SNAPSHOT_KEY;

  function parseRecord(raw: unknown): SnapshotRecord<T> {
    if (!isRecordLike(raw)) {
      throw new StorageError('snapshot record is not an object', 'corrupt', { key });
    }
    const version = (raw as { version?: unknown }).version;
    if (typeof version !== 'number' || version < 1) {
      throw new StorageError('snapshot record has no state version', 'corrupt', { key });
    }
    if (version > SNAPSHOT_RECORD_VERSION) {
      throw new StorageError(
        `snapshot record version ${version} unsupported (this build supports up to ${SNAPSHOT_RECORD_VERSION}) — refusing to open`,
        'corrupt',
        { key, detectedVersion: version, unsupportedVersion: version },
      );
    }
    const revision = (raw as { revision?: unknown }).revision;
    if (typeof revision !== 'number' || !Number.isInteger(revision) || revision < 0) {
      throw new StorageError('snapshot record has an invalid revision', 'corrupt', { key });
    }
    const savedAt = (raw as { savedAt?: unknown }).savedAt;
    if (typeof savedAt !== 'number') {
      throw new StorageError('snapshot record has an invalid savedAt', 'corrupt', { key });
    }
    if ((raw as { state?: unknown }).state === undefined) {
      throw new StorageError('snapshot record has no state', 'corrupt', { key });
    }
    const state = (raw as { state: unknown }).state as T;
    try {
      validate(state);
    } catch (err) {
      if (err instanceof StorageError) throw err;
      throw new StorageError(
        `snapshot record failed validation: ${(err as Error).message}`,
        'corrupt',
        { key, cause: err },
      );
    }
    return { version, revision, state, savedAt } as SnapshotRecord<T>;
  }

  async function readRaw(): Promise<{ record: SnapshotRecord<T> | null; raw: unknown }> {
    const raw: unknown = await adapter.get(key);
    if (raw === null || raw === undefined) return { record: null, raw: null };
    return { record: parseRecord(raw), raw };
  }

  return {
    async load(): Promise<T> {
      const { record } = await readRaw();
      return record ? record.state : options.empty();
    },

    async getRecord(): Promise<SnapshotRecord<T>> {
      const { record } = await readRaw();
      return (
        record ?? {
          version: SNAPSHOT_RECORD_VERSION,
          revision: 0,
          state: options.empty(),
          savedAt: 0,
        }
      );
    },

    async getRevision(): Promise<number> {
      const { record } = await readRaw();
      return record ? record.revision : 0;
    },

    async hasState(): Promise<boolean> {
      // Presence, not validity: a corrupt record is still "present" and must
      // never be silently reinitialised — validity is surfaced by load().
      return adapter.has(key);
    },

    async mutate(update: (state: T) => T): Promise<SnapshotRecord<T>> {
      return withStorageLock(adapter, async () => {
        const result = await adapter.conditionalUpdate<SnapshotRecord<T>>(key, (current) => {
          const base = current === null || current === undefined ? options.empty() : parseRecord(current).state;
          const next = jsonClean(update(base)) as T;
          try {
            validate(next);
          } catch (err) {
            if (err instanceof StorageError) throw err;
            throw new StorageError(
              `snapshot transition failed validation: ${(err as Error).message}`,
              'write-failed',
              { key, cause: err },
            );
          }
          return {
            next: {
              version: SNAPSHOT_RECORD_VERSION,
              revision: (current?.revision ?? 0) + 1,
              state: next,
              savedAt: Date.now(),
            },
          };
        });
        if (!result.applied || result.value === null) {
          throw new StorageError('snapshot CAS update not applied', 'write-failed', { key });
        }
        return parseRecord(result.value);
      });
    },
  };
}