import { SyncSqliteStore } from '@totemsdk/storage/sqlite-sync';

/**
 * Durable Map facade for host state (factories, virtual channels, splices,
 * VTXOs, pools). Backed by `@totemsdk/storage/sqlite-sync` (same `totemsdk_kv`
 * table + versioned codec as the channel/operation stores).
 *
 * Values are plain objects/arrays/bigints/Uint8Arrays. Runtime-only handles
 * (`localSigner`, signer/lease/swarm objects) are stripped; Map/Set/Date are
 * explicitly tagged so they round-trip. A function anywhere else is dropped
 * rather than persisted (never serialise authority material by accident).
 */

export const HOST_STATE_FORMAT_KEY = 'omnia:store:host-state:format';
export const HOST_STATE_FORMAT = 1;

const EPHEMERAL_KEYS = new Set([
  'localSigner',
  'signer',
  'leaseProvider',
  'signerPort',
  'swarm',
  'routing',
]);

type Encoded =
  | null
  | string
  | number
  | boolean
  | bigint
  | Uint8Array
  | Encoded[]
  | { [key: string]: Encoded }
  | { $map: Array<[string, Encoded]> }
  | { $set: Encoded[] }
  | { $date: string };

function encode(value: unknown, seen = new WeakSet<object>()): Encoded {
  if (value === null || value === undefined) return null;
  if (typeof value === 'bigint') return value;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'function') return null;
  if (value instanceof Uint8Array) return value;
  if (value instanceof Date) return { $date: value.toISOString() };
  if (Array.isArray(value)) {
    return value.map((item) => encode(item, seen));
  }
  if (value instanceof Map) {
    const entries: Array<[string, Encoded]> = [];
    for (const [key, item] of value.entries()) entries.push([String(key), encode(item, seen)]);
    return { $map: entries };
  }
  if (value instanceof Set) {
    return { $set: Array.from(value.values(), (item) => encode(item, seen)) };
  }
  if (typeof value === 'object') {
    if (seen.has(value as object)) throw new Error('cannot persist cyclic host state');
    seen.add(value as object);
    const out: Record<string, Encoded> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (EPHEMERAL_KEYS.has(key) || item === undefined || typeof item === 'function') continue;
      out[key] = encode(item, seen);
    }
    seen.delete(value as object);
    return out;
  }
  return null;
}

function decode(value: Encoded): unknown {
  if (value === null) return null;
  if (
    typeof value === 'bigint' ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }
  if (value instanceof Uint8Array) return value;
  if (Array.isArray(value)) return value.map(decode);
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (Array.isArray(record['$map'])) {
      return new Map(
        (record['$map'] as Array<[string, Encoded]>).map(([key, item]) => [key, decode(item)]),
      );
    }
    if (Array.isArray(record['$set'])) {
      return new Set((record['$set'] as Encoded[]).map(decode));
    }
    if (typeof record['$date'] === 'string') return new Date(record['$date']);
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(record)) out[key] = decode(item as Encoded);
    return out;
  }
  return value;
}

function iterator<T>(values: T[]): MapIterator<T> {
  let index = 0;
  return {
    next(): IteratorResult<T> {
      if (index >= values.length) return { done: true, value: undefined };
      return { done: false, value: values[index++] };
    },
    [Symbol.iterator](): MapIterator<T> {
      return this;
    },
    [Symbol.dispose](): void {
      index = values.length;
    },
  };
}

export class PersistentMap<V> extends Map<string, V> {
  constructor(
    private readonly kv: SyncSqliteStore,
    private readonly namespace: string,
  ) {
    super();
    const format = kv.get<number>(HOST_STATE_FORMAT_KEY);
    if (format !== null && format !== HOST_STATE_FORMAT) {
      throw new Error(
        `Unsupported omnia-host state format ${format} (this build supports ${HOST_STATE_FORMAT}) — refusing to open`,
      );
    }
    if (format === null) kv.set(HOST_STATE_FORMAT_KEY, HOST_STATE_FORMAT);
  }

  private key(id: string): string {
    return this.namespace + id;
  }

  private keysInNamespace(): string[] {
    return this.kv.keys().filter((key) => key.startsWith(this.namespace));
  }

  override get(id: string): V | undefined {
    const raw = this.kv.get<Encoded>(this.key(id));
    return raw === null ? undefined : (decode(raw) as V);
  }

  override set(id: string, value: V): this {
    this.kv.set(this.key(id), encode(value));
    return this;
  }

  override has(id: string): boolean {
    return this.kv.has(this.key(id));
  }

  override delete(id: string): boolean {
    return this.kv.remove(this.key(id));
  }

  override clear(): void {
    for (const key of this.keysInNamespace()) this.kv.remove(key);
  }

  override get size(): number {
    return this.keysInNamespace().length;
  }

  override keys(): MapIterator<string> {
    return iterator(this.keysInNamespace().map((key) => key.slice(this.namespace.length)));
  }

  override values(): MapIterator<V> {
    return iterator(Array.from(this.entries(), ([, value]) => value));
  }

  override entries(): MapIterator<[string, V]> {
    return iterator(
      this.keysInNamespace().map((key) => [
        key.slice(this.namespace.length),
        decode(this.kv.get<Encoded>(key)!) as V,
      ]),
    );
  }

  override [Symbol.iterator](): MapIterator<[string, V]> {
    return this.entries();
  }

  override forEach(callbackfn: (value: V, key: string, map: Map<string, V>) => void): void {
    for (const [key, value] of this.entries()) callbackfn(value, key, this);
  }
}
