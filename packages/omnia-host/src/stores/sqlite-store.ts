import { SyncSqliteStore } from '@totemsdk/storage/sqlite-sync';
import { recoverChannel, serializeChannelSnapshot, type OmniaChannel, type ChannelSigner } from '@totemsdk/omnia';

const PREFIX = 'omnia:channel:';
const FORMAT_KEY = 'omnia:store:channel:format';
const STORE_FORMAT = 1;

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

/**
 * Synchronous Map facade accepted by @totemsdk/omnia's ChannelStore type,
 * persisted through `@totemsdk/storage` (`SyncSqliteStore`, same codec/envelope
 * as `SqliteStore`). Legacy `omnia_channels` tables are migrated on open.
 */
export class SqliteChannelStore extends Map<string, OmniaChannel> {
  private readonly kv: SyncSqliteStore;
  /**
   * CAN-002: a recovered channel loses `localSigner` (it is not serializable),
   * so the router's `counterpartPkd()` cannot tell which party is local and
   * multi-hop payments loop back. Re-bind the host's signer on every read.
   */
  private localSigner?: ChannelSigner;

  constructor(dbPath: string) {
    super();
    this.kv = new SyncSqliteStore(dbPath);
    const version = this.kv.get<number>(FORMAT_KEY);
    if (version !== null && version !== STORE_FORMAT) {
      this.kv.close();
      throw new Error(
        `Unsupported SqliteChannelStore format ${version} (this build supports ${STORE_FORMAT}) — refusing to open`,
      );
    }
    if (version === null) {
      // One-time migration from the pre-storage direct-SQLite table.
      this.kv.migrateLegacyTable<string>('omnia_channels', (row) => ({
        key: PREFIX + String(row['channel_id']),
        value: String(row['channel_json']),
      }));
      this.kv.set(FORMAT_KEY, STORE_FORMAT);
    }
  }

  /** Attach the host's signer so recovered channels carry it (CAN-002). */
  setLocalSigner(signer?: ChannelSigner): void {
    this.localSigner = signer;
  }

  private rebind(channel: OmniaChannel): OmniaChannel {
    return this.localSigner ? { ...channel, localSigner: this.localSigner } : channel;
  }

  private channelKeys(): string[] {
    return this.kv.keys().filter((key) => key.startsWith(PREFIX));
  }

  private idOf(key: string): string {
    return key.slice(PREFIX.length);
  }

  override get(channelId: string): OmniaChannel | undefined {
    const snapshot = this.kv.get<string>(PREFIX + channelId);
    return snapshot ? this.rebind(recoverChannel(snapshot)) : undefined;
  }

  override set(channelId: string, channel: OmniaChannel): this {
    this.kv.set(PREFIX + channelId, serializeChannelSnapshot(channel));
    return this;
  }

  override has(channelId: string): boolean {
    return this.kv.has(PREFIX + channelId);
  }

  override delete(channelId: string): boolean {
    return this.kv.remove(PREFIX + channelId);
  }

  override clear(): void {
    for (const key of this.channelKeys()) this.kv.remove(key);
  }

  override get size(): number {
    return this.channelKeys().length;
  }

  override entries(): MapIterator<[string, OmniaChannel]> {
    const rows = this.channelKeys().map((key) => {
      const snapshot = this.kv.get<string>(key)!;
      return [this.idOf(key), this.rebind(recoverChannel(snapshot))] as [string, OmniaChannel];
    });
    return iterator(rows);
  }

  override keys(): MapIterator<string> {
    return iterator(this.channelKeys().map((key) => this.idOf(key)));
  }

  override values(): MapIterator<OmniaChannel> {
    return iterator(Array.from(this.entries(), ([, channel]) => channel));
  }

  override [Symbol.iterator](): MapIterator<[string, OmniaChannel]> {
    return this.entries();
  }

  override forEach(callbackfn: (value: OmniaChannel, key: string, map: Map<string, OmniaChannel>) => void): void {
    for (const [key, value] of this.entries()) callbackfn(value, key, this);
  }

  close(): void {
    this.kv.close();
  }
}
