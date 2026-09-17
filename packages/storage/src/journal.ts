/**
 * @module @totemsdk/storage/journal
 *
 * Append-only, restart-recoverable record journal (RFC-007 §4.2).
 *
 * The journal is the home for *audit* records (inference usage/execution,
 * MQTT replay, WOTS watermarks, identity chains). Two rules from §4.2 shape it:
 *
 *  - **Single accounting authority.** The journal *records*; the owning domain
 *    interface *accounts*. It never competes as a second counter — consumers
 *    reconcile the journal against their own authority (`GrantUsageStore`,
 *    commerce outbox/replay, `WatermarkStore`), never read "totals" from it.
 *  - **Versioned, forward-migratable records.** Every entry carries an explicit
 *    format version. Older versions are migrated on read via a declared hook;
 *    an unsupported/ambiguous version **refuses to open** (`corrupt`) rather
 *    than being silently dropped or reinitialised.
 *
 * Sequences are allocated by a CAS bump of a head counter, so multiple journal
 * instances sharing one store never collide. A write that crashes between the
 * head bump and the entry write leaves a hole — an *unrecorded tail* whose
 * entry never durably existed. `recover()` rolls the head back to the last
 * contiguous entry (that uncompleted append is not an audit record); any gap
 * strictly below the contiguous tail is surfaced as corruption, never treated
 * as absence.
 *
 * Requires `durably-acknowledged` + conditional (CAS) writes by default;
 * pass `requireAckMode: 'volatile'` only for tests/dev adapters like
 * `MemoryStore` (no silent downgrade).
 */

import {
  assertCapabilities,
  type CasStore,
  type StorageAdapterWithCapabilities,
  type WriteAckMode,
} from './types.js';
import { StorageError } from './errors.js';
import { jsonClean } from './snapshot.js';

const DEFAULT_NAMESPACE = 'totem_journal:v1:';
const HEAD_KEY = 'head';

/**
 * Current entry format version. 1 is the 2026 initial journal layout; set to 2
 * so that genuinely older journal formats can be demonstrated as
 * forward-migratable on read (migration is opt-in via `JournalOptions.migrate`).
 */
export const JOURNAL_RECORD_VERSION = 2;

/** One immutable journal entry. */
export interface JournalEntry<T> {
  /** Format version of this entry's record (forward-migratable on read). */
  readonly version: number;
  /** Monotonic, collision-free sequence (1-based; 0 = no entries). */
  readonly seq: number;
  readonly createdAt: number;
  readonly record: T;
}

export interface JournalOptions<T> {
  /** Key namespace prefix; default `totem_journal:v1:`. */
  readonly namespace?: string;
  /**
   * Required write acknowledgment; default `durably-acknowledged`. Pass
   * `volatile` only for tests/dev adapters (e.g. `MemoryStore`).
   */
  readonly requireAckMode?: WriteAckMode;
  /**
   * Forward-migrate an older record version to the current shape. Invoked on
   * every read of an entry whose `version` predates `JOURNAL_RECORD_VERSION`.
   * A migration that cannot be performed, or an entry whose version exceeds
   * the current one, refuses to open as `corrupt` — never silent.
   */
  readonly migrate?: (version: number, record: unknown) => T;
  /** Optional structural validation run on every appended/read record. */
  readonly validate?: (record: T) => void | never;
}

export interface JournalRecoveryReport {
  /** Highest contiguous durably-recorded sequence. */
  readonly headAfter: number;
  /** Head before `recover()` ran (may already equal `headAfter`). */
  readonly headBefore: number;
  /** True when an unrecorded tail was rolled back (crash between bump+write). */
  readonly repairedUnrecordedTail: boolean;
  /** seqs missing below the contiguous tail — corruption the journal refuses. */
  readonly gapAt: readonly number[];
}

export interface Journal<T> {
  /** Append one record; returns the immutable entry. */
  append(record: T): Promise<JournalEntry<T>>;
  /**
   * Append records in order. Not atomic across adapters (append-only records
   * are immutable, so a failure partway is an unrecorded tail, repaired by
   * `recover()`); entries are appendable one-at-a-time.
   */
  appendBatch(records: readonly T[]): Promise<JournalEntry<T>[]>;
  /** Replay records in ascending sequence, `fromSeq`..`toSeq` (default: all records so far). */
  read(fromSeq?: number, toSeq?: number): Promise<JournalEntry<T>[]>;
  /** Replay records after `seq` (checkpoint resume), ascending. */
  readSince(seq: number): Promise<JournalEntry<T>[]>;
  /** Last `count` records, ascending (clamped). */
  tail(count: number): Promise<JournalEntry<T>[]>;
  /** Highest contiguous durably-recorded sequence (0 when empty). */
  getHead(): Promise<number>;
  /** Number of durably-recorded entries (contiguous from 1). */
  count(): Promise<number>;
  /** True when the journal holds any state (head or entries). */
  hasState(): Promise<boolean>;
  /**
   * Repair a possibly torn head: roll back an unrecorded tail left by a crash
   * between CAS head bump and entry write; surface any gap below the
   * contiguous tail as `corrupt`.
   */
  recover(): Promise<JournalRecoveryReport>;
}

function assertEntryEnvelope(raw: unknown, key: string): { version: number; seq: number; createdAt: number; record: unknown } {
  if (typeof raw !== 'object' || raw === null) {
    throw new StorageError('journal entry is not an object', 'corrupt', { key });
  }
  const version = (raw as { version?: unknown }).version;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    throw new StorageError('journal entry has no record format version', 'corrupt', { key });
  }
  if (version > JOURNAL_RECORD_VERSION) {
    throw new StorageError(
      `journal entry record version ${version} unsupported (this build supports up to ${JOURNAL_RECORD_VERSION}) — refusing to open`,
      'corrupt',
      { key, detectedVersion: version, unsupportedVersion: version },
    );
  }
  const seq = (raw as { seq?: unknown }).seq;
  if (typeof seq !== 'number' || !Number.isInteger(seq) || seq < 1) {
    throw new StorageError('journal entry has an invalid seq', 'corrupt', { key });
  }
  const createdAt = (raw as { createdAt?: unknown }).createdAt;
  if (typeof createdAt !== 'number') {
    throw new StorageError('journal entry has an invalid createdAt', 'corrupt', { key });
  }
  if ((raw as { record?: unknown }).record === undefined) {
    throw new StorageError('journal entry has no record', 'corrupt', { key });
  }
  return { version, seq, createdAt, record: (raw as { record: unknown }).record };
}

/** Serialize entry writes on one adapter (intra-instance sequencing; cross-instance safety comes from the CAS head). */
const locks = new WeakMap<StorageAdapterWithCapabilities, Promise<unknown>>();

function withJournalLock<V>(adapter: StorageAdapterWithCapabilities, fn: () => Promise<V>): Promise<V> {
  const tail = locks.get(adapter);
  const next = tail ? tail.then(fn, fn) : fn();
  const settled = next.catch(() => undefined);
  locks.set(adapter, settled);
  return next;
}

export function createJournal<T>(
  adapter: StorageAdapterWithCapabilities & CasStore,
  options: JournalOptions<T> = {},
): Journal<T> {
  assertCapabilities(adapter, {
    acknowledge: options.requireAckMode ?? 'durably-acknowledged',
    conditional: true,
  });

  const ns = options.namespace ?? DEFAULT_NAMESPACE;
  const headKey = ns + HEAD_KEY;
  const entryKey = (seq: number): string => `${ns}entry:${seq}`;
  const migrate = options.migrate;
  const validate = options.validate ?? (() => undefined);

  function resolveRecord(entry: { version: number; record: unknown }, key: string): T {
    let record: T;
    if (entry.version === JOURNAL_RECORD_VERSION) {
      record = entry.record as T;
    } else if (entry.version < JOURNAL_RECORD_VERSION && migrate) {
      record = migrate(entry.version, entry.record);
    } else {
      throw new StorageError(
        `journal entry record version ${entry.version} requires a migration that is not declared — refusing to open`,
        'corrupt',
        { key, detectedVersion: entry.version, unsupportedVersion: entry.version },
      );
    }
    try {
      validate(record);
    } catch (err) {
      if (err instanceof StorageError) throw err;
      throw new StorageError(
        `journal record failed validation: ${(err as Error).message}`,
        'corrupt',
        { key, cause: err },
      );
    }
    return record;
  }

  async function readHead(): Promise<number> {
    const raw: unknown = await adapter.get(headKey);
    if (raw === null || raw === undefined) return 0;
    if (typeof raw !== 'number' || !Number.isInteger(raw) || raw < 0) {
      throw new StorageError('journal head is not a non-negative integer', 'corrupt', { key: headKey });
    }
    return raw;
  }

  function parseEntry(seq: number, raw: unknown): JournalEntry<T> {
    const envelope = assertEntryEnvelope(raw, entryKey(seq));
    if (envelope.seq !== seq) {
      throw new StorageError(`journal entry key/seq mismatch (stored ${envelope.seq}, expected ${seq})`, 'corrupt', {
        key: entryKey(seq),
      });
    }
    return {
      version: envelope.version,
      seq,
      createdAt: envelope.createdAt,
      record: resolveRecord(envelope, entryKey(seq)),
    };
  }

  /** Highest contiguous durably-recorded seq, walking down past an unrecorded tail. */
  async function contiguousTail(head: number): Promise<number> {
    let t = head;
    while (t >= 1 && !(await adapter.has(entryKey(t)))) t -= 1;
    return t;
  }

  async function readRange(from: number, to: number): Promise<JournalEntry<T>[]> {
    const head = await readHead();
    const tail = await contiguousTail(head);
    const clampedTo = Math.min(to, tail);
    const entries: JournalEntry<T>[] = [];
    for (let seq = from; seq <= clampedTo; seq += 1) {
      if (seq > tail) break;
      const raw: unknown = await adapter.get(entryKey(seq));
      if (raw === null || raw === undefined) {
        throw new StorageError(`journal has a hole below the contiguous tail (seq ${seq})`, 'corrupt', {
          key: entryKey(seq),
        });
      }
      entries.push(parseEntry(seq, raw));
    }
    return entries;
  }

  return {
    async append(record: T): Promise<JournalEntry<T>> {
      try {
        validate(record);
      } catch (err) {
        if (err instanceof StorageError) throw err;
        throw new StorageError(`journal append failed validation: ${(err as Error).message}`, 'write-failed');
      }

      return withJournalLock(adapter, async () => {
        const bump = await adapter.conditionalUpdate<number>(headKey, (current) => ({
          next: (current ?? 0) + 1,
        }));
        if (bump.applied === false || bump.value === null) {
          throw new StorageError('journal head CAS not applied', 'write-failed', { key: headKey });
        }
        const seq = bump.value;
        const entry = {
          version: JOURNAL_RECORD_VERSION,
          seq,
          createdAt: Date.now(),
          record,
        };
        try {
          await adapter.set(entryKey(seq), jsonClean(entry) as typeof entry);
        } catch (err) {
          // Best-effort roll-back of the torn head; recover() repairs if raced.
          await adapter.conditionalUpdate<number>(headKey, (current) => {
            if (current === seq) return { next: seq - 1 };
            return { abort: 'head moved' };
          });
          throw new StorageError('journal entry write failed', 'write-failed', {
            key: entryKey(seq),
            cause: err,
          });
        }
        return entry;
      });
    },

    async appendBatch(records: readonly T[]): Promise<JournalEntry<T>[]> {
      const entries: JournalEntry<T>[] = [];
      for (const record of records) entries.push(await this.append(record));
      return entries;
    },

    async read(fromSeq = 1, toSeq = Number.POSITIVE_INFINITY): Promise<JournalEntry<T>[]> {
      const head = await readHead();
      const tail = await contiguousTail(head);
      const from = Math.max(1, Math.trunc(fromSeq));
      const to = Math.min(Math.trunc(toSeq), tail);
      if (from > to) return [];
      return readRange(from, to);
    },

    async readSince(seq: number): Promise<JournalEntry<T>[]> {
      return this.read(Math.trunc(seq) + 1, Number.POSITIVE_INFINITY);
    },

    async tail(count: number): Promise<JournalEntry<T>[]> {
      const head = await readHead();
      const tail = await contiguousTail(head);
      const n = Math.min(Math.max(0, Math.trunc(count)), tail);
      return n === 0 ? [] : readRange(tail - n + 1, tail);
    },

    getHead: readHead,
    async count(): Promise<number> {
      const head = await readHead();
      return contiguousTail(head);
    },

    async hasState(): Promise<boolean> {
      return adapter.has(headKey);
    },

    async recover(): Promise<JournalRecoveryReport> {
      const headBefore = await readHead();
      const tail = await contiguousTail(headBefore);
      // A hole strictly below the contiguous tail means a *durably recorded*
      // entry is missing — corruption we never paper over.
      for (let seq = 1; seq < tail; seq += 1) {
        if (!(await adapter.has(entryKey(seq)))) {
          throw new StorageError(`journal hole below contiguous tail at seq ${seq}`, 'corrupt', {
            key: entryKey(seq),
          });
        }
      }
      let repairedUnrecordedTail = false;
      if (tail < headBefore) {
        const rollback = await adapter.conditionalUpdate<number>(headKey, (current) => {
          if (current === headBefore) return { next: tail };
          return { abort: 'head moved' };
        });
        repairedUnrecordedTail = rollback.applied;
      }
      return {
        headAfter: tail,
        headBefore,
        repairedUnrecordedTail,
        gapAt: [],
      };
    },
  };
}