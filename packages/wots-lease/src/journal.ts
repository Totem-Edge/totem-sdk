/**
 * LeaseJournal — physically append-only audit log for WOTS key-use events.
 *
 * Layout v1 stores one immutable record per sequence. The legacy whole-array
 * key is retained as migration input/forensic history but is never rewritten.
 * The SHA-256 chain format is intentionally unchanged (RFC-007 OQ3).
 */

import { createHash } from 'crypto';
import type { StorageAdapter, LoggerAdapter } from '@totemsdk/core';
import { NoopLogger } from '@totemsdk/core';
import { StorageError } from '@totemsdk/storage/errors';
import type { JournalEntry } from './types.js';

const LEGACY_STORAGE_KEY = 'totem_wots_journal';
const ENTRY_PREFIX = 'totem_wots_journal:v1:entry:';
const RECORD_VERSION = 1;
const SEQUENCE_WIDTH = 16;
const MAX_INDEX_COMPONENT = 63;
const HASH_PATTERN = /^[0-9a-f]{64}$/;
const KEY_PATTERN = /^(\d{16}):([0-9a-f]{64})$/;
const STATUSES = new Set<JournalEntry['status']>([
  'reserved',
  'committed',
  'burned',
  'reserved-expired',
]);
const storageTails = new WeakMap<object, Promise<void>>();

interface JournalRecordV1 {
  formatVersion: 1;
  sequence: number;
  entry: JournalEntry;
}

interface ParsedRecordKey {
  key: string;
  sequence: number;
  hash: string;
}

function withStorageLock<T>(storage: StorageAdapter, fn: () => Promise<T>): Promise<T> {
  const prior = storageTails.get(storage as object) ?? Promise.resolve();
  const run = prior.then(fn, fn);
  storageTails.set(storage as object, run.then(() => undefined, () => undefined));
  return run;
}

/** Existing commitment format; property names/order and SHA-256 stay unchanged. */
function hashEntry(entry: JournalEntry): string {
  const encoder = new TextEncoder();
  const data = {
    t: entry.treeId,
    b: entry.branchId,
    i: entry.wotsIndex,
    s: entry.status,
    r: entry.reservationId,
    p: entry.previousHash,
    ts: entry.timestamp,
    d: entry.deviceId,
  };
  const bytes = encoder.encode(JSON.stringify(data));
  return createHash('sha256').update(bytes).digest('hex');
}

function cloneEntry(entry: JournalEntry): JournalEntry {
  return {
    treeId: entry.treeId,
    branchId: entry.branchId,
    wotsIndex: entry.wotsIndex,
    indices: { ...entry.indices },
    status: entry.status,
    ...(entry.reservationId !== undefined ? { reservationId: entry.reservationId } : {}),
    ...(entry.payloadHash !== undefined ? { payloadHash: entry.payloadHash } : {}),
    ...(entry.txId !== undefined ? { txId: entry.txId } : {}),
    timestamp: entry.timestamp,
    deviceId: entry.deviceId,
    ...(entry.previousHash !== undefined ? { previousHash: entry.previousHash } : {}),
    ...(entry.hash !== undefined ? { hash: entry.hash } : {}),
  };
}

function asObject(value: unknown, key: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new StorageError(`LeaseJournal: invalid object at ${key}`, 'corrupt', { key });
  }
  return value as Record<string, unknown>;
}

function requiredString(object: Record<string, unknown>, field: string, key: string): string {
  const value = object[field];
  if (typeof value !== 'string' || value.length === 0) {
    throw new StorageError(`LeaseJournal: invalid ${field} at ${key}`, 'corrupt', { key });
  }
  return value;
}

function optionalString(object: Record<string, unknown>, field: string, key: string): string | undefined {
  const value = object[field];
  if (value === undefined) return undefined;
  if (typeof value !== 'string') {
    throw new StorageError(`LeaseJournal: invalid ${field} at ${key}`, 'corrupt', { key });
  }
  return value;
}

function requiredInteger(object: Record<string, unknown>, field: string, key: string): number {
  const value = object[field];
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new StorageError(`LeaseJournal: invalid ${field} at ${key}`, 'corrupt', { key });
  }
  return value;
}

function validateEntry(value: unknown, key: string): JournalEntry {
  const object = asObject(value, key);
  const indices = asObject(object.indices, `${key}.indices`);
  const status = requiredString(object, 'status', key) as JournalEntry['status'];
  if (!STATUSES.has(status)) {
    throw new StorageError(`LeaseJournal: invalid status at ${key}`, 'corrupt', { key });
  }
  const timestamp = object.timestamp;
  if (typeof timestamp !== 'number' || !Number.isFinite(timestamp) || timestamp < 0) {
    throw new StorageError(`LeaseJournal: invalid timestamp at ${key}`, 'corrupt', { key });
  }

  const validated = cloneEntry({
    treeId: requiredString(object, 'treeId', key),
    branchId: requiredString(object, 'branchId', key),
    wotsIndex: requiredInteger(object, 'wotsIndex', key),
    indices: {
      addressIndex: requiredInteger(indices, 'addressIndex', `${key}.indices`),
      l1: requiredInteger(indices, 'l1', `${key}.indices`),
      l2: requiredInteger(indices, 'l2', `${key}.indices`),
    },
    status,
    reservationId: optionalString(object, 'reservationId', key),
    payloadHash: optionalString(object, 'payloadHash', key),
    txId: optionalString(object, 'txId', key),
    timestamp,
    deviceId: requiredString(object, 'deviceId', key),
    previousHash: optionalString(object, 'previousHash', key),
    hash: optionalString(object, 'hash', key),
  });
  const { addressIndex, l1, l2 } = validated.indices;
  if (addressIndex > MAX_INDEX_COMPONENT || l1 > MAX_INDEX_COMPONENT || l2 > MAX_INDEX_COMPONENT) {
    throw new StorageError(`LeaseJournal: indices out of range at ${key}`, 'corrupt', { key });
  }
  const expectedIndex = addressIndex * 64 * 64 + l1 * 64 + l2;
  if (validated.wotsIndex !== expectedIndex) {
    throw new StorageError(`LeaseJournal: wotsIndex/indices mismatch at ${key}`, 'corrupt', { key });
  }
  return validated;
}

function verifyChain(entries: JournalEntry[], source: string): void {
  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i];
    if (entry.hash === undefined || !HASH_PATTERN.test(entry.hash)) {
      throw new StorageError(`LeaseJournal: invalid hash at ${source}[${i}]`, 'corrupt');
    }
    const expectedHash = hashEntry(entry);
    if (entry.hash !== expectedHash) {
      throw new StorageError(`LeaseJournal: hash mismatch at ${source}[${i}]`, 'corrupt');
    }
    if (i === 0) {
      if (entry.previousHash !== undefined) {
        throw new StorageError(`LeaseJournal: first entry has previousHash at ${source}[0]`, 'corrupt');
      }
    } else if (entry.previousHash !== entries[i - 1].hash) {
      throw new StorageError(`LeaseJournal: previousHash mismatch at ${source}[${i}]`, 'corrupt');
    }
  }
}

function entriesEqual(a: JournalEntry, b: JournalEntry): boolean {
  return a.treeId === b.treeId
    && a.branchId === b.branchId
    && a.wotsIndex === b.wotsIndex
    && a.indices.addressIndex === b.indices.addressIndex
    && a.indices.l1 === b.indices.l1
    && a.indices.l2 === b.indices.l2
    && a.status === b.status
    && a.reservationId === b.reservationId
    && a.payloadHash === b.payloadHash
    && a.txId === b.txId
    && a.timestamp === b.timestamp
    && a.deviceId === b.deviceId
    && a.previousHash === b.previousHash
    && a.hash === b.hash;
}

function sequenceText(sequence: number): string {
  return sequence.toString(10).padStart(SEQUENCE_WIDTH, '0');
}

function recordKey(sequence: number, hash: string): string {
  return `${ENTRY_PREFIX}${sequenceText(sequence)}:${hash}`;
}

function parseRecordKey(key: string): ParsedRecordKey {
  const relative = key.slice(ENTRY_PREFIX.length);
  const match = KEY_PATTERN.exec(relative);
  if (!match) {
    throw new StorageError(`LeaseJournal: malformed record key ${key}`, 'corrupt', { key });
  }
  const sequence = Number(match[1]);
  if (!Number.isSafeInteger(sequence)) {
    throw new StorageError(`LeaseJournal: invalid sequence in ${key}`, 'corrupt', { key });
  }
  return { key, sequence, hash: match[2] };
}

export class LeaseJournal {
  private entries: JournalEntry[] = [];
  private initialized = false;
  private initializePromise: Promise<void> | null = null;
  private appendTail: Promise<void> = Promise.resolve();

  constructor(
    private readonly storage: StorageAdapter,
    private readonly logger: LoggerAdapter = new NoopLogger(),
  ) {}

  async initialize(): Promise<void> {
    if (this.initialized) return;
    if (!this.initializePromise) {
      this.initializePromise = withStorageLock(this.storage, () => this.initializeOnce()).catch((error: unknown) => {
        this.initializePromise = null;
        throw error;
      });
    }
    await this.initializePromise;
  }

  private async initializeOnce(): Promise<void> {
    const physical = await this.readPhysicalRecords();
    const legacy = await this.readLegacyEntries();

    if (legacy !== null) {
      const commonLength = Math.min(physical.length, legacy.length);
      for (let i = 0; i < commonLength; i += 1) {
        if (!entriesEqual(physical[i], legacy[i])) {
          throw new StorageError(`LeaseJournal: legacy/v1 divergence at sequence ${i}`, 'corrupt');
        }
      }
      for (let i = physical.length; i < legacy.length; i += 1) {
        await this.writeRecord(i, legacy[i]);
      }
    }

    const replayed = legacy !== null && legacy.length > physical.length
      ? await this.readPhysicalRecords()
      : physical;
    this.entries = replayed.map(cloneEntry);
    this.initialized = true;
  }

  private async readLegacyEntries(): Promise<JournalEntry[] | null> {
    const raw = await this.storage.get<unknown>(LEGACY_STORAGE_KEY);
    if (raw === null) return null;
    if (!Array.isArray(raw)) {
      throw new StorageError('LeaseJournal: legacy journal is not an array', 'corrupt', { key: LEGACY_STORAGE_KEY });
    }
    const entries = raw.map((entry, index) => validateEntry(entry, `${LEGACY_STORAGE_KEY}[${index}]`));
    verifyChain(entries, LEGACY_STORAGE_KEY);
    return entries;
  }

  private async readPhysicalRecords(): Promise<JournalEntry[]> {
    const parsed = (await this.storage.keys())
      .filter((key) => key.startsWith(ENTRY_PREFIX))
      .map(parseRecordKey)
      .sort((a, b) => a.sequence - b.sequence || a.key.localeCompare(b.key));

    for (let i = 0; i < parsed.length; i += 1) {
      if (i > 0 && parsed[i - 1].sequence === parsed[i].sequence) {
        throw new StorageError(`LeaseJournal: fork at sequence ${parsed[i].sequence}`, 'corrupt');
      }
      if (parsed[i].sequence !== i) {
        throw new StorageError(`LeaseJournal: sequence gap at ${i}`, 'corrupt');
      }
    }

    const entries: JournalEntry[] = [];
    for (const descriptor of parsed) {
      const raw = await this.storage.get<unknown>(descriptor.key);
      if (raw === null) {
        throw new StorageError(`LeaseJournal: listed record is missing`, 'corrupt', { key: descriptor.key });
      }
      const record = asObject(raw, descriptor.key);
      const formatVersion = record.formatVersion;
      if (formatVersion !== RECORD_VERSION) {
        throw new StorageError('LeaseJournal: unsupported record version', 'corrupt', {
          key: descriptor.key,
          detectedVersion: typeof formatVersion === 'number' ? formatVersion : undefined,
          unsupportedVersion: typeof formatVersion === 'number' ? formatVersion : undefined,
        });
      }
      if (record.sequence !== descriptor.sequence) {
        throw new StorageError('LeaseJournal: sequence/key mismatch', 'corrupt', { key: descriptor.key });
      }
      const entry = validateEntry(record.entry, `${descriptor.key}.entry`);
      if (entry.hash !== descriptor.hash) {
        throw new StorageError('LeaseJournal: hash/key mismatch', 'corrupt', { key: descriptor.key });
      }
      entries.push(entry);
    }

    verifyChain(entries, ENTRY_PREFIX);
    return entries;
  }

  private async writeRecord(sequence: number, entry: JournalEntry): Promise<void> {
    if (entry.hash === undefined) {
      throw new StorageError(`LeaseJournal: entry ${sequence} has no hash`, 'corrupt');
    }
    const key = recordKey(sequence, entry.hash);
    const record: JournalRecordV1 = {
      formatVersion: RECORD_VERSION,
      sequence,
      entry: cloneEntry(entry),
    };
    await this.storage.set(key, record);
  }

  append(entry: JournalEntry): Promise<void> {
    const run = this.appendTail.then(async () => this.appendOne(entry));
    this.appendTail = run.catch(() => undefined);
    return run;
  }

  private async appendOne(input: JournalEntry): Promise<void> {
    await this.initialize();
    await withStorageLock(this.storage, async () => {
      // Refresh under the shared lock so multiple journal instances that share
      // the same adapter object cannot allocate the same sequence or slot.
      this.entries = (await this.readPhysicalRecords()).map(cloneEntry);
      const entry = validateEntry(cloneEntry(input), 'append');
      if (entry.status === 'reserved' && this.entries.some(
        (existing) => existing.treeId === entry.treeId && existing.wotsIndex === entry.wotsIndex,
      )) {
        throw new StorageError(
          `LeaseJournal: WOTS slot ${entry.treeId}/${entry.wotsIndex} is already recorded`,
          'write-failed',
        );
      }
      if (entry.status !== 'reserved' && entry.reservationId) {
        const latest = [...this.entries].reverse().find(
          (existing) => existing.reservationId === entry.reservationId,
        );
        if (latest?.status === entry.status) {
          if (latest.treeId !== entry.treeId || latest.wotsIndex !== entry.wotsIndex
            || (entry.status === 'committed' && latest.txId !== entry.txId)) {
            throw new StorageError(
              `LeaseJournal: reservation ${entry.reservationId} is already ${latest.status} for a different use`,
              'write-failed',
            );
          }
          if (latest.previousHash === undefined) delete input.previousHash;
          else input.previousHash = latest.previousHash;
          input.hash = latest.hash;
          return;
        }
        if (latest && latest.status !== 'reserved') {
          throw new StorageError(
            `LeaseJournal: reservation ${entry.reservationId} is already ${latest.status}`,
            'write-failed',
          );
        }
      }

      const previous = this.entries[this.entries.length - 1];
      if (previous?.hash !== undefined) entry.previousHash = previous.hash;
      else delete entry.previousHash;
      entry.hash = hashEntry(entry);

      const sequence = this.entries.length;
      const sequencePrefix = `${ENTRY_PREFIX}${sequenceText(sequence)}:`;
      if ((await this.storage.keys()).some((key) => key.startsWith(sequencePrefix))) {
        throw new StorageError(`LeaseJournal: sequence ${sequence} already exists`, 'write-failed');
      }

      await this.writeRecord(sequence, entry);
      this.entries.push(entry);

      if (entry.previousHash === undefined) delete input.previousHash;
      else input.previousHash = entry.previousHash;
      input.hash = entry.hash;
      this.logger.debug(
        `[LeaseJournal] ${entry.status} treeId=${entry.treeId} idx=${entry.wotsIndex} `
        + `txId=${entry.txId ?? '-'} hash=${entry.hash.slice(0, 8)}`,
      );
    });
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('LeaseJournal not initialized — call initialize() first');
    }
  }

  getAll(): JournalEntry[] {
    this.ensureInitialized();
    return this.entries.map(cloneEntry);
  }

  getByTree(treeId: string): JournalEntry[] {
    this.ensureInitialized();
    return this.entries.filter((entry) => entry.treeId === treeId).map(cloneEntry);
  }

  getByReservation(reservationId: string): JournalEntry | undefined {
    this.ensureInitialized();
    const entry = [...this.entries].reverse().find((candidate) => candidate.reservationId === reservationId);
    return entry ? cloneEntry(entry) : undefined;
  }

  async clear(): Promise<void> {
    throw new StorageError('LeaseJournal is append-only and cannot be cleared', 'write-failed');
  }
}
